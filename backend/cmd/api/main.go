package main

import (
	"core/internal/config"
	"core/internal/domain/service"
	"core/internal/infrastructure/persistence/mysql"
	"core/internal/presentation/http/handler"
	"core/internal/presentation/http/router"
	"database/sql"
	"log"

	_ "core/docs" // Swagger docs

	_ "github.com/go-sql-driver/mysql"
)

// @title Core API
// @version 1.0
// @description API for managing products with authentication
// @host localhost:9090
// @BasePath /
// @securityDefinitions.apikey BearerAuth
// @in header
// @name Authorization
// @description Type "Bearer" followed by a space and JWT token.
func main() {
	// Cargar config
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("failed to load config: %v", err)
	}

	// Conectar a MySQL
	db, err := sql.Open("mysql", cfg.DSN)
	if err != nil {
		log.Fatalf("failed to connect to database: %v", err)
	}
	defer db.Close()

	if err := db.Ping(); err != nil {
		log.Fatalf("failed to ping database: %v", err)
	}

	// Repositorios
	productRepo := mysql.NewProductRepository(db)
	productImageRepo := mysql.NewProductImageRepository(db)
	userRepo := mysql.NewUserRepository(db)

	// Servicios
	productService := service.NewProductService(productRepo)

	// Handlers
	productHandler := handler.NewProductHandler(productService)
	productImageHandler := handler.NewProductImageHandler(productRepo, productImageRepo)
	authHandler := handler.NewAuthHandler(userRepo, cfg)

	// Router
	e := router.Router(productHandler, productImageHandler, authHandler, cfg)

	// Start server
	log.Printf("Server starting on %s", cfg.ServerAddress)
	if err := e.Start(cfg.ServerAddress); err != nil {
		log.Fatalf("failed to start server: %v", err)
	}
}
