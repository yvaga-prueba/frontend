package main

import (
	"context"
	"database/sql"
	"log"

	"core/adapter/gdrive"
	mercadoenvios "core/adapter/mercado_envios"
	"core/adapter/repository/mysql/entity"
	router "core/api/http"
	"core/api/http/handle"
	"core/config"
	"core/domain/repo" // <-- agregamos import
	"core/domain/service"

	_ "core/docs" // Swagger docs

	_ "github.com/go-sql-driver/mysql"
)

// @title Core API
// @version 1.0
// @description API for managing products with authentication
// @host localhost:8080
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
	clientActivityRepo := entity.NewClientActivityRepository(db)
	sellerRepo := entity.NewSellerRepo(db)
	
	// ---> NUEVO REPO DE SETTINGS <---
	settingRepo := repo.NewSettingRepo(db)

	// Storage Service (Google Drive)
	if !cfg.GoogleDrive.Enabled {
		log.Fatalf("Google Drive no está configurado. Definí GDRIVE_CLIENT_ID, GDRIVE_CLIENT_SECRET, GDRIVE_REFRESH_TOKEN y GDRIVE_FOLDER_ID en el .env")
	}
	storageAdapter, err := gdrive.New(
		context.Background(),
		cfg.GoogleDrive.ClientID,
		cfg.GoogleDrive.ClientSecret,
		cfg.GoogleDrive.RefreshToken,
		cfg.GoogleDrive.FolderID,
	)
	if err != nil {
		log.Fatalf("failed to initialize Google Drive storage: %v", err)
	}
	var storageService service.StorageService = storageAdapter

	// Servicios (Domain)
	productService := service.NewProductService(productRepo)
	afipService := service.NewAfipService(ticketRepo, cfg.AFIP)
	ticketService := service.NewTicketService(ticketRepo, ticketLineRepo, productRepo, afipService, sellerRepo, userRepo)
	clientActivityService := service.NewClientActivityService(clientActivityRepo)
	shippingService := mercadoenvios.NewMercadoEnviosService(cfg.MercadoPago)
	sellerService := service.NewSellerService(sellerRepo)
	
	// servicio de setting
	settingService := service.NewSettingService(settingRepo)


	// Handlers (API)
	productHandler := handle.NewProductHandler(productService, productImageRepo)
	productImageHandler := handle.NewProductImageHandler(productRepo, productImageRepo, storageService)
	authHandler := handle.NewAuthHandler(userRepo, cfg)
	sellerHandler := handle.NewSellerHandler(sellerService)
	
	// nuevo handlres setting 
	settingHandler := handle.NewSettingHandler(settingService)

	// Facade Handler
	productFacadeHandler := handle.NewProductFacadeHandler(productHandler, productImageHandler)

	// Ticket Handler
	ticketHandler := handle.NewTicketHandler(ticketService, userRepo)

	// Payment Handler (MercadoPago + transfer)
	paymentHandler := handle.NewPaymentHandler(ticketService, cfg)

	// Activity Handler
	activityHandler := handle.NewClientActivityHandler(clientActivityService)

	// Shipping Handler
	shippingHandler := handle.NewShippingHandler(shippingService)

	// Router (Aca pasamos el settingHandler como un parametro más antes de cfg)
	e := router.Router(
		productHandler, 
		productImageHandler, 
		authHandler, 
		productFacadeHandler, 
		ticketHandler, 
		paymentHandler, 
		activityHandler, 
		shippingHandler, 
		sellerHandler, 
		settingHandler, // <--- AGREGADO ACA
		cfg,
	)

	// Start server
	log.Printf("Server starting on %s", cfg.ServerAddress)
	if err := e.Start(cfg.ServerAddress); err != nil {
		log.Fatalf("failed to start server: %v", err)
	}
}