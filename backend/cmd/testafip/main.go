package main

import (
	"context"
	"database/sql"
	"fmt"
	"log"
	"time"

	"core/adapter/repository/mysql/entity"
	"core/config"
	"core/domain/model"
	"core/domain/service"

	_ "github.com/go-sql-driver/mysql"
)

func main() {
	cfg, err := config.Load()
	if err != nil {
		log.Fatal(err)
	}

	db, err := sql.Open("mysql", cfg.DSN)
	if err != nil {
		log.Fatal(err)
	}
	defer db.Close()

	if err := db.Ping(); err != nil {
		log.Fatal(err)
	}

	userRepo := entity.NewUserRepository(db)
	productRepo := entity.NewProductRepository(db)
	ticketRepo := entity.NewTicketRepository(db)
	ticketLineRepo := entity.NewTicketLineRepository(db)

	ctx := context.Background()

	// Crear usuario temporal
	user := &model.User{
		FirstName: "Admin",
		LastName:  "Test",
		Email:     fmt.Sprintf("afip-test-%d@yvaga.com", time.Now().Unix()),
		Password:  "hash",
		Role:      "admin",
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}
	err = userRepo.Store(ctx, user)
	if err != nil {
		log.Fatal(err)
	}

	// Crear producto temporal
	prod := &model.Product{
		Title:       "Remera Afip",
		Description: "Descripción",
		UnitPrice:   15000,
		Category:    "remeras",
		CreatedAt:   time.Now(),
		UpdatedAt:   time.Now(),
	}
	err = productRepo.Create(ctx, prod)
	if err != nil {
		log.Fatal(err)
	}

	// Para la prueba forzamos configuración mínima si no estuviese en el .env
	cfg.AFIP.Enabled = true
	if cfg.AFIP.CUIT == 0 {
		cfg.AFIP.CUIT = 20123456789
	}
	afipSvc := service.NewAfipService(ticketRepo, cfg.AFIP)
	ticketSvc := service.NewTicketService(ticketRepo, ticketLineRepo, productRepo, afipSvc)

	items := []service.TicketItemRequest{
		{ProductID: prod.ID, Quantity: 1},
	}

	log.Println("Creando ticket en efectivo (cash) con Facturación automática...")
	tkt, _, err := ticketSvc.CreateTicket(ctx, user.ID, items, model.PaymentMethodCash, "Testing AFIP", model.TicketStatusPaid)
	if err != nil {
		log.Fatal("Error creando ticket:", err)
	}

	log.Printf("Ticket creado: %s, a la espera de que se genere factura AFIP en background...", tkt.TicketNumber)
	time.Sleep(2 * time.Second) // dar tiempo a que termine el proceso background

	// Volver a consultar de DB para ver los campos AFIP!
	tktDB, err := ticketRepo.GetByID(ctx, tkt.ID)
	if err != nil {
		log.Fatal(err)
	}

	if tktDB.InvoiceNumber != nil && *tktDB.InvoiceNumber != "" {
		log.Println("¡ÉXITO! Se generaron los campos de AFIP en DB:")
		log.Printf(" > Tipo Comprobante: %s\n", *tktDB.InvoiceType)
		log.Printf(" > Nro. Comprobante: %s\n", *tktDB.InvoiceNumber)
		log.Printf(" > CAE: %s\n", *tktDB.CAE)
		log.Printf(" > Vencimiento CAE: %v\n", *tktDB.CAEDueDate)
	} else {
		log.Println("FALLO: No se encontraron los campos AFIP generados en el ticket de base de datos.")
	}
}
