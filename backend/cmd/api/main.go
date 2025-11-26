package main

import (
	"core/internal/config"
	"core/internal/product"
	"core/internal/product_image"
	"core/internal/product_with_images"
	"core/internal/router"
	"core/internal/user"
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
	productRepo := product.NewProductRepository(db)
	productImageRepo := product_image.NewProductImageRepository(db)
	userRepo := user.NewUserRepository(db)

	// Servicios
	productService := product.NewProductService(productRepo)

	// Handlers
	productHandler := product.NewProductHandler(productService)
	productImageHandler := product_image.NewProductImageHandler(productRepo, productImageRepo)
	authHandler := user.NewAuthHandler(userRepo, cfg)

	// Nuevo facade
	productFacadeHandler := product_with_images.NewProductFacadeHandler(productHandler, productImageHandler)

	// Router
	e := router.Router(productHandler, productImageHandler, authHandler, productFacadeHandler, cfg)

	// Start server
	log.Printf("Server starting on %s", cfg.ServerAddress)
	if err := e.Start(cfg.ServerAddress); err != nil {
		log.Fatalf("failed to start server: %v", err)
	}
}
