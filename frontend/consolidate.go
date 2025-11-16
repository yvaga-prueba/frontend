package main

import (
	"fmt"
	"io/fs"
	"os"
	"path/filepath"
	"strings"
)

// Extensiones de archivos que queremos incluir
var allowedExtensions = map[string]bool{
	".go":   true,
	".sql":  true,
	".mod":  true,
	".sum":  true,
	".toml": true,
	".yaml": true,
	".yml":  true,
	".env":  true,
	".md":   true,
	".ts:":  true,
	".html": true,
	".css":  true,
	".json": true,
}

// Directorios que queremos ignorar
var ignoredDirs = map[string]bool{
	"vendor":       true,
	"node_modules": true,
	"tmp":          true,
	"tmp_app":      true,
	"bin":          true,
	".git":         true,
	".idea":        true,
	".vscode":      true,
	"docs":         true, // Ignorar docs generados por Swagger
}

// Archivos específicos que queremos ignorar
var ignoredFiles = map[string]bool{
	"go.sum":           true,
	"tree_output.txt":  true,
	"consolidated.txt": true, // Para no incluirse a sí mismo
}

func main() {
	outputFile := "consolidated.txt"

	// Abrir archivo de salida
	f, err := os.Create(outputFile)
	if err != nil {
		fmt.Printf("Error creating output file: %v\n", err)
		os.Exit(1)
	}
	defer f.Close()

	// Escribir encabezado
	f.WriteString("=" + strings.Repeat("=", 78) + "\n")
	f.WriteString("  CONSOLIDATED PROJECT FILES\n")
	f.WriteString("=" + strings.Repeat("=", 78) + "\n\n")

	// Contador de archivos procesados
	fileCount := 0

	// Recorrer el proyecto
	err = filepath.WalkDir(".", func(path string, d fs.DirEntry, err error) error {
		if err != nil {
			return err
		}

		// Ignorar directorios específicos
		if d.IsDir() {
			if ignoredDirs[d.Name()] {
				return fs.SkipDir
			}
			return nil
		}

		// Ignorar archivos específicos
		if ignoredFiles[d.Name()] {
			return nil
		}

		// Verificar extensión
		ext := filepath.Ext(path)
		if !allowedExtensions[ext] {
			return nil
		}

		// Leer contenido del archivo
		content, err := os.ReadFile(path)
		if err != nil {
			fmt.Printf("Warning: could not read %s: %v\n", path, err)
			return nil
		}

		// Escribir separador y nombre del archivo
		f.WriteString("\n" + strings.Repeat("=", 80) + "\n")
		f.WriteString(fmt.Sprintf("FILE: %s\n", path))
		f.WriteString(strings.Repeat("=", 80) + "\n\n")

		// Escribir contenido
		f.Write(content)
		f.WriteString("\n")

		fileCount++
		fmt.Printf("✓ Processed: %s\n", path)

		return nil
	})

	if err != nil {
		fmt.Printf("Error walking directory: %v\n", err)
		os.Exit(1)
	}

	// Escribir resumen al final
	f.WriteString("\n" + strings.Repeat("=", 80) + "\n")
	f.WriteString(fmt.Sprintf("TOTAL FILES PROCESSED: %d\n", fileCount))
	f.WriteString(strings.Repeat("=", 80) + "\n")

	fmt.Printf("\n✅ Consolidation complete! %d files written to %s\n", fileCount, outputFile)
}
