package service

import (
	"context"
	"encoding/base64"
	"fmt"
	"log"
	"time"

	"core/config"
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
	cfg        config.AFIPConfig
}

func NewAfipService(ticketRepo repo.TicketRepository, cfg config.AFIPConfig) AfipService {
	// Opcionalmente, validar y precargar los certificados en memoria aquí
	if cfg.Enabled {
		log.Printf("[AFIP] Iniciando servicio. Entorno: %s, CUIT: %d\n", cfg.Environment, cfg.CUIT)

		if cfg.CertToken != "" {
			log.Println("[AFIP] Se detectó Certificado configurado vía Token (Base64).")
		} else if cfg.CertPath != "" {
			log.Printf("[AFIP] Se detectó Certificado configurado vía Ruta: %s\n", cfg.CertPath)
		} else {
			log.Println("[AFIP] ATENCIÓN: No hay certificado configurado (ni Path ni Token).")
		}

		if cfg.KeyToken != "" {
			log.Println("[AFIP] Se detectó Clave Privada configurada vía Token (Base64).")
		} else if cfg.KeyPath != "" {
			log.Printf("[AFIP] Se detectó Clave Privada configurada vía Ruta: %s\n", cfg.KeyPath)
		} else {
			log.Println("[AFIP] ATENCIÓN: No hay clave privada configurada (ni Path ni Token).")
		}
	}

	return &afipServiceImpl{
		ticketRepo: ticketRepo,
		cfg:        cfg,
	}
}

func (s *afipServiceImpl) GenerateInvoice(ctx context.Context, ticket *model.Ticket) (string, string, string, time.Time, error) {
	if !s.cfg.Enabled {
		return "", "", "", time.Time{}, nil
	}

	if s.cfg.CUIT == 0 {
		return "", "", "", time.Time{}, fmt.Errorf("AFIP integration is enabled but AFIP_CUIT is missing/invalid")
	}

	var certBytes, keyBytes []byte
	var err error

	// 1. Cargar Certificado
	if s.cfg.CertToken != "" {
		certBytes, err = base64.StdEncoding.DecodeString(s.cfg.CertToken)
		if err != nil {
			return "", "", "", time.Time{}, fmt.Errorf("failed to decode AFIP_CERT_TOKEN: %w", err)
		}
	} else if s.cfg.CertPath != "" {
		// certBytes, err = os.ReadFile(s.cfg.CertPath)
		// si se usara el archivo físico real...
		certBytes = []byte("simulated_cert_from_path")
	}

	// 2. Cargar Clave Privada
	if s.cfg.KeyToken != "" {
		keyBytes, err = base64.StdEncoding.DecodeString(s.cfg.KeyToken)
		if err != nil {
			return "", "", "", time.Time{}, fmt.Errorf("failed to decode AFIP_KEY_TOKEN: %w", err)
		}
	} else if s.cfg.KeyPath != "" {
		// keyBytes, err = os.ReadFile(s.cfg.KeyPath)
		// si se usara el archivo físico real...
		keyBytes = []byte("simulated_key_from_path")
	}

	// Podrías validar que existan los bytes, esto es sólo ilustrativo en la pseudo-integración
	_ = certBytes
	_ = keyBytes

	// === SIMULACIÓN DE INTEGRACIÓN CON AFIP ===
	// Para integrar de manera real con el entorno de homologación/producción de AFIP
	// usar por ejemplo: github.com/martinarra/afip-go
	log.Printf("[AFIP] (%s) Contactando WSFE para CUIT %d, Ticket #%s (Total: $%.2f)...\n",
		s.cfg.Environment, s.cfg.CUIT, ticket.TicketNumber, ticket.Total)
	time.Sleep(1 * time.Second) // Simula la latencia de la red

	invType := "C"                                           // Por defecto Factura C (Consumidor Final / Monotributo)
	invNum := fmt.Sprintf("0001-%08d", ticket.ID)            // Punto de venta 0001
	cae := fmt.Sprintf("7100%d", time.Now().UnixNano()/1000) // CAE falso de 14 dígitos
	caeDue := time.Now().AddDate(0, 0, 10)                   // Vencimiento del CAE en 10 días

	log.Printf("[AFIP] ¡Factura exitosa! Tipo: %s, Nro: %s, CAE: %s\n", invType, invNum, cae)

	// Persiste los datos de AFIP en la base de datos para este ticket
	err = s.ticketRepo.UpdateAFIPFields(ctx, ticket.ID, invType, invNum, cae, caeDue)
	if err != nil {
		return "", "", "", time.Time{}, fmt.Errorf("error saving AFIP fields in DB: %w", err)
	}

	ticket.InvoiceType = &invType
	ticket.InvoiceNumber = &invNum
	ticket.CAE = &cae
	ticket.CAEDueDate = &caeDue

	return invType, invNum, cae, caeDue, nil
}
