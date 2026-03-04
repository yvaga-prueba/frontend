package main

import (
	"context"
	"database/sql"
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
		log.Fatal("config:", err)
	}

	// Sobrescribir para asegurar que AFIP está activo en este test
	cfg.AFIP.Enabled = true
	log.Printf("[TEST] Entorno AFIP: %s, CUIT: %d", cfg.AFIP.Environment, cfg.AFIP.CUIT)
	log.Printf("[TEST] Cert: %s | Key: %s", cfg.AFIP.CertPath, cfg.AFIP.KeyPath)

	db, err := sql.Open("mysql", cfg.DSN)
	if err != nil {
		log.Fatal("db open:", err)
	}
	defer db.Close()
	if err := db.Ping(); err != nil {
		log.Fatal("db ping:", err)
	}

	ticketRepo := entity.NewTicketRepository(db)
	afipSvc := service.NewAfipService(ticketRepo, cfg.AFIP)

	ctx := context.Background()

	// Armamos un ticket en memoria sin tocarlo en la DB —
	// sólo para disparar la llamada real a AFIP WSAA + WSFE.
	total := 15000.0
	ticket := &model.Ticket{
		ID:           999999, // ID ficticio. UpdateAFIPFields puede fallar si no existe la row.
		TicketNumber: "TEST-001",
		Total:        total,
	}

	log.Println("[TEST] Llamando a GenerateInvoice contra AFIP homologación...")
	invType, invNum, cae, caeDue, err := afipSvc.GenerateInvoice(ctx, ticket)
	if err != nil {
		log.Fatalf("[TEST] ERROR: %v", err)
	}

	if cae == "" {
		log.Println("[TEST] AFIP devolvió CAE vacío (revisar respuesta WSFE)")
		return
	}

	log.Println("[TEST] ✅ ¡Éxito!")
	log.Printf("  > Tipo Comprobante : %s\n", invType)
	log.Printf("  > Nro. Comprobante : %s\n", invNum)
	log.Printf("  > CAE              : %s\n", cae)
	log.Printf("  > Vto. CAE         : %s\n", caeDue.Format(time.DateOnly))
}
