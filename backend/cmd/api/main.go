package main

import (
	"database/sql"
	"log"

	"core/adapter/repository/mysql/entity"
	router "core/api/http"
	"core/api/http/handle"
	"core/config"
	"core/domain/service"

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

	// Repositorios (Adapters)
	productRepo := entity.NewProductRepository(db)
	productImageRepo := entity.NewProductImageRepository(db)
	userRepo := entity.NewUserRepository(db)
	ticketRepo := entity.NewTicketRepository(db)
	ticketLineRepo := entity.NewTicketLineRepository(db)

	// Servicios (Domain)
	productService := service.NewProductService(productRepo)
	afipService := service.NewAfipService(ticketRepo, cfg.AFIP)
	ticketService := service.NewTicketService(ticketRepo, ticketLineRepo, productRepo, afipService)

	// Handlers (API)
	productHandler := handle.NewProductHandler(productService)
	productImageHandler := handle.NewProductImageHandler(productRepo, productImageRepo)
	authHandler := handle.NewAuthHandler(userRepo, cfg)

	// Facade Handler
	productFacadeHandler := handle.NewProductFacadeHandler(productHandler, productImageHandler)

	// Ticket Handler
	ticketHandler := handle.NewTicketHandler(ticketService, userRepo)

	// Payment Handler (MercadoPago + transfer)
	paymentHandler := handle.NewPaymentHandler(ticketService, cfg)

	// Router
	e := router.Router(productHandler, productImageHandler, authHandler, productFacadeHandler, ticketHandler, paymentHandler, cfg)

	// Start server
	log.Printf("Server starting on %s", cfg.ServerAddress)
	if err := e.Start(cfg.ServerAddress); err != nil {
		log.Fatalf("failed to start server: %v", err)
	}
}
