package service

import (
	"context"
	"fmt"
	"log"
	"time"

	"core/domain/model"
	"core/domain/repo"
)

// AfipService defines the interface to interact with AFIP
type AfipService interface {
	// GenerateInvoice returns the invoice type, invoice number, CAE and CAE due date
	GenerateInvoice(ctx context.Context, ticket *model.Ticket) (invType, invNum, cae string, caeDue time.Time, err error)
}

type afipServiceImpl struct {
	ticketRepo repo.TicketRepository
	enabled    bool
}

func NewAfipService(ticketRepo repo.TicketRepository, enabled bool) AfipService {
	return &afipServiceImpl{
		ticketRepo: ticketRepo,
		enabled:    enabled,
	}
}

func (s *afipServiceImpl) GenerateInvoice(ctx context.Context, ticket *model.Ticket) (string, string, string, time.Time, error) {
	if !s.enabled {
		return "", "", "", time.Time{}, nil
	}

	// === SIMULACIÓN DE INTEGRACIÓN CON AFIP ===
	// Para integrar de manera real con el entorno de homologación/producción de AFIP
	// se requiere:
	// 1. CUIT de la empresa
	// 2. Certificado digital (.crt) y Clave privada (.key) para autenticación WSAA
	// 3. Ejecutar peticiones SOAP a WSFE (Web Service de Factura Electrónica API)
	//
	// Como actualmente no tenemos los certificados, simulamos el comportamiento:
	log.Printf("[AFIP] Contactando WSFE para generar Factura del ticket #%s (Total: $%.2f)...\n", ticket.TicketNumber, ticket.Total)
	time.Sleep(1 * time.Second) // Simula la latencia de la red

	invType := "C"                                           // Por defecto Factura C (Consumidor Final / Monotributo)
	invNum := fmt.Sprintf("0001-%08d", ticket.ID)            // Punto de venta 0001
	cae := fmt.Sprintf("7100%d", time.Now().UnixNano()/1000) // CAE falso de 14 dígitos
	caeDue := time.Now().AddDate(0, 0, 10)                   // Vencimiento del CAE en 10 días

	log.Printf("[AFIP] ¡Factura exitosa! Tipo: %s, Nro: %s, CAE: %s\n", invType, invNum, cae)

	// Persiste los datos de AFIP en la base de datos para este ticket
	err := s.ticketRepo.UpdateAFIPFields(ctx, ticket.ID, invType, invNum, cae, caeDue)
	if err != nil {
		return "", "", "", time.Time{}, fmt.Errorf("error saving AFIP fields in DB: %w", err)
	}

	ticket.InvoiceType = &invType
	ticket.InvoiceNumber = &invNum
	ticket.CAE = &cae
	ticket.CAEDueDate = &caeDue

	return invType, invNum, cae, caeDue, nil
}
