package main

import (
	"crypto/sha256"
	"database/sql"
	"fmt"
	"io/fs"
	"log"
	"os"
	"path/filepath"
	"sort"
	"strings"

	"core/internal/config"

	_ "github.com/go-sql-driver/mysql"
)

const migrationsDir = "migrations"

type migration struct {
	version  string
	path     string
	checksum string
	content  string
}

type migrationStatus struct {
	version         string
	applied         bool
	checksumMatch   bool
	appliedChecksum string
	currentChecksum string
}

func main() {
	if len(os.Args) < 2 {
		log.Fatal("Usage: migrate [up|down|status]")
	}

	// Cargar configuración desde .env
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("Failed to load config: %v", err)
	}

	// Conectar a MySQL usando el DSN construido
	db, err := sql.Open("mysql", cfg.DSN)
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}
	defer db.Close()

	if err := db.Ping(); err != nil {
		log.Fatalf("Failed to ping database: %v", err)
	}

	log.Printf("Connected to database: %s@%s:%s/%s", cfg.DBUser, cfg.DBHost, cfg.DBPort, cfg.DBName)

	// Asegurar que existe la tabla de control
	if err := ensureSchemaMigrationsTable(db); err != nil {
		log.Fatalf("Failed to create schema_migrations table: %v", err)
	}

	switch os.Args[1] {
	case "up":
		if err := migrateUp(db); err != nil {
			log.Fatal(err)
		}
		log.Println("✓ Migration up completed successfully")
	case "down":
		if err := migrateDown(db); err != nil {
			log.Fatal(err)
		}
		log.Println("✓ Migration down completed successfully")
	case "status":
		if err := showStatus(db); err != nil {
			log.Fatal(err)
		}
	default:
		log.Fatal("Invalid command. Use 'up', 'down', or 'status'")
	}
}

func ensureSchemaMigrationsTable(db *sql.DB) error {
	query := `
		CREATE TABLE IF NOT EXISTS schema_migrations (
			id BIGINT AUTO_INCREMENT PRIMARY KEY,
			version VARCHAR(255) NOT NULL UNIQUE,
			checksum VARCHAR(64) NOT NULL,
			applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
			INDEX idx_version (version)
		) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
	`
	_, err := db.Exec(query)
	return err
}

func showStatus(db *sql.DB) error {
	// Cargar todas las migraciones .up.sql del filesystem
	migrations, err := loadMigrations(migrationsDir, ".up.sql")
	if err != nil {
		return err
	}

	if len(migrations) == 0 {
		log.Println("⊘ No migrations found in", migrationsDir)
		return nil
	}

	// Obtener migraciones aplicadas de la BD
	applied, err := getAppliedMigrations(db)
	if err != nil {
		return err
	}

	// Construir status de cada migración
	var statuses []migrationStatus
	for _, m := range migrations {
		status := migrationStatus{
			version:         m.version,
			currentChecksum: m.checksum,
			applied:         false,
			checksumMatch:   true,
		}

		if appliedChecksum, exists := applied[m.version]; exists {
			status.applied = true
			status.appliedChecksum = appliedChecksum
			status.checksumMatch = (appliedChecksum == m.checksum)
		}

		statuses = append(statuses, status)
	}

	// Detectar migraciones huérfanas (aplicadas pero sin archivo)
	for version, checksum := range applied {
		found := false
		for _, m := range migrations {
			if m.version == version {
				found = true
				break
			}
		}
		if !found {
			statuses = append(statuses, migrationStatus{
				version:         version,
				applied:         true,
				appliedChecksum: checksum,
				checksumMatch:   false, // no hay archivo para comparar
			})
		}
	}

	// Ordenar por version
	sort.Slice(statuses, func(i, j int) bool {
		return statuses[i].version < statuses[j].version
	})

	// Imprimir tabla de status
	fmt.Println()
	fmt.Println("Migration Status")
	fmt.Println(strings.Repeat("=", 80))
	fmt.Printf("%-40s %-12s %-20s\n", "VERSION", "STATUS", "CHECKSUM")
	fmt.Println(strings.Repeat("-", 80))

	pendingCount := 0
	appliedCount := 0
	mismatchCount := 0

	for _, s := range statuses {
		statusStr := ""
		checksumStr := ""

		if !s.applied {
			statusStr = "⏳ PENDING"
			checksumStr = "—"
			pendingCount++
		} else if !s.checksumMatch {
			statusStr = "❌ APPLIED"
			checksumStr = "⚠️  MISMATCH"
			mismatchCount++
		} else {
			statusStr = "✓ APPLIED"
			checksumStr = "OK"
			appliedCount++
		}

		fmt.Printf("%-40s %-12s %-20s\n", s.version, statusStr, checksumStr)
	}

	fmt.Println(strings.Repeat("=", 80))
	fmt.Printf("Total: %d | Applied: %d | Pending: %d | Mismatches: %d\n",
		len(statuses), appliedCount, pendingCount, mismatchCount)
	fmt.Println()

	if mismatchCount > 0 {
		fmt.Println("⚠️  WARNING: Some migrations have checksum mismatches!")
		fmt.Println("   This means the migration file was modified after being applied.")
		fmt.Println("   Running 'migrate up' will fail. Review changes carefully.")
		fmt.Println()
	}

	if pendingCount > 0 {
		fmt.Printf("💡 Run 'migrate up' to apply %d pending migration(s)\n", pendingCount)
		fmt.Println()
	}

	return nil
}

func migrateUp(db *sql.DB) error {
	migrations, err := loadMigrations(migrationsDir, ".up.sql")
	if err != nil {
		return err
	}

	if len(migrations) == 0 {
		log.Println("⊘ No migrations found")
		return nil
	}

	applied, err := getAppliedMigrations(db)
	if err != nil {
		return err
	}

	for _, m := range migrations {
		if appliedChecksum, exists := applied[m.version]; exists {
			// Validar checksum
			if appliedChecksum != m.checksum {
				return fmt.Errorf(
					"❌ CHECKSUM MISMATCH for %s\nApplied: %s\nCurrent: %s\nMigration file was modified after being applied!",
					m.version, appliedChecksum, m.checksum,
				)
			}
			log.Printf("⊘ Skipping %s (already applied)", m.version)
			continue
		}

		// Aplicar migración
		log.Printf("→ Applying %s...", m.version)
		if err := applyMigration(db, m); err != nil {
			return fmt.Errorf("failed to apply %s: %w", m.version, err)
		}

		// Registrar en schema_migrations
		if err := recordMigration(db, m.version, m.checksum); err != nil {
			return fmt.Errorf("failed to record %s: %w", m.version, err)
		}

		log.Printf("✓ Applied %s", m.version)
	}

	return nil
}

func migrateDown(db *sql.DB) error {
	migrations, err := loadMigrations(migrationsDir, ".down.sql")
	if err != nil {
		return err
	}

	if len(migrations) == 0 {
		log.Println("⊘ No down migrations found")
		return nil
	}

	applied, err := getAppliedMigrations(db)
	if err != nil {
		return err
	}

	// Aplicar en orden inverso
	for i := len(migrations) - 1; i >= 0; i-- {
		m := migrations[i]

		// Saltar si no está aplicada
		if _, exists := applied[m.version]; !exists {
			log.Printf("⊘ Skipping %s (not applied)", m.version)
			continue
		}

		// Aplicar rollback
		log.Printf("→ Rolling back %s...", m.version)
		if err := applyMigration(db, m); err != nil {
			return fmt.Errorf("failed to rollback %s: %w", m.version, err)
		}

		// Eliminar registro
		if err := removeMigrationRecord(db, m.version); err != nil {
			return fmt.Errorf("failed to remove record %s: %w", m.version, err)
		}

		log.Printf("✓ Rolled back %s", m.version)
	}

	return nil
}

func loadMigrations(dir string, suffix string) ([]migration, error) {
	files, err := listSQLWithSuffix(dir, suffix)
	if err != nil {
		return nil, err
	}

	var migrations []migration
	for _, path := range files {
		content, err := os.ReadFile(path)
		if err != nil {
			return nil, fmt.Errorf("read %s: %w", path, err)
		}

		// Extraer version: quitar .up.sql o .down.sql
		filename := filepath.Base(path)
		version := strings.TrimSuffix(filename, suffix)
		checksum := calculateChecksum(content)

		migrations = append(migrations, migration{
			version:  version,
			path:     path,
			checksum: checksum,
			content:  string(content),
		})
	}

	return migrations, nil
}

func listSQLWithSuffix(dir string, suffix string) ([]string, error) {
	var files []string
	err := filepath.WalkDir(dir, func(path string, d fs.DirEntry, err error) error {
		if err != nil {
			return err
		}
		if d.IsDir() {
			return nil
		}
		if strings.HasSuffix(strings.ToLower(d.Name()), suffix) {
			files = append(files, path)
		}
		return nil
	})
	if err != nil {
		return nil, err
	}
	sort.Strings(files)
	return files, nil
}

func calculateChecksum(content []byte) string {
	hash := sha256.Sum256(content)
	return fmt.Sprintf("%x", hash)
}

func getAppliedMigrations(db *sql.DB) (map[string]string, error) {
	rows, err := db.Query("SELECT version, checksum FROM schema_migrations")
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	applied := make(map[string]string)
	for rows.Next() {
		var version, checksum string
		if err := rows.Scan(&version, &checksum); err != nil {
			return nil, err
		}
		applied[version] = checksum
	}

	return applied, rows.Err()
}

func applyMigration(db *sql.DB, m migration) error {
	statements := splitStatements(m.content)
	for _, stmt := range statements {
		stmt = strings.TrimSpace(stmt)
		if stmt == "" {
			continue
		}
		if _, err := db.Exec(stmt); err != nil {
			return fmt.Errorf("statement failed: %w\nSQL: %s", err, stmt)
		}
	}
	return nil
}

func recordMigration(db *sql.DB, version, checksum string) error {
	_, err := db.Exec(
		"INSERT INTO schema_migrations (version, checksum) VALUES (?, ?)",
		version, checksum,
	)
	return err
}

func removeMigrationRecord(db *sql.DB, version string) error {
	_, err := db.Exec("DELETE FROM schema_migrations WHERE version = ?", version)
	return err
}

func splitStatements(sql string) []string {
	return strings.Split(sql, ";")
}
