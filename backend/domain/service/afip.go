package service

import (
	"context"
	"fmt"
	"log"
	"reflect"
	"time"

	"github.com/sisuani/gowsfe/pkg/afip/wsafip"
	"github.com/sisuani/gowsfe/pkg/afip/wsfe"

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
	if cfg.Enabled {
		log.Printf("[AFIP] Servicio inicializado. Entorno: %s, CUIT: %d\n", cfg.Environment, cfg.CUIT)
		if cfg.CertPath != "" {
			log.Printf("[AFIP] Certificado: %s\n", cfg.CertPath)
		}
		if cfg.KeyPath != "" {
			log.Printf("[AFIP] Clave privada: %s\n", cfg.KeyPath)
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
		return "", "", "", time.Time{}, fmt.Errorf("[AFIP] AFIP_CUIT no configurado")
	}
	if s.cfg.CertPath == "" || s.cfg.KeyPath == "" {
		return "", "", "", time.Time{}, fmt.Errorf("[AFIP] AFIP_CERT_PATH y AFIP_KEY_PATH son requeridos")
	}

	// ─── 1. Autenticación WSAA ──────────────────────────────────────────────
	// La librería gowsfe imprime REQUEST/RESPONSE XML (incluyendo el TA firmado)
	// cuando environment == TESTING. Para evitar que el token quede expuesto en
	// logs stdout, en ambos entornos usamos wsafip.PRODUCTION (silencia el log).
	// La URL real del endpoint la sobreescribimos vía reflect según el entorno.
	wsaaService := wsafip.NewService(wsafip.PRODUCTION, s.cfg.CertPath, s.cfg.KeyPath)

	// Parchear URL interna para apuntar al endpoint correcto sin activar el verbose log
	wsaaEndpoint := "https://wsaahomo.afip.gov.ar/ws/services/LoginCms?WSDL"
	if s.cfg.Environment == "production" {
		wsaaEndpoint = "https://wsaa.afip.gov.ar/ws/services/LoginCms?WSDL"
	}
	// El campo urlWsaa es privado, lo sobreescribimos con reflect
	wsaaSvc := reflect.ValueOf(wsaaService).Elem()
	if f := wsaaSvc.FieldByName("urlWsaa"); f.IsValid() && f.CanSet() {
		f.SetString(wsaaEndpoint)
	}

	token, sign, _, err := wsaaService.GetLoginTicket("wsfe")
	if err != nil {
		return "", "", "", time.Time{}, fmt.Errorf("[AFIP] Error obteniendo ticket WSAA: %w", err)
	}
	log.Printf("[AFIP] Token WSAA obtenido correctamente\n")

	// ─── 2. WSFE: obtener último comprobante autorizado ─────────────────────
	wsfeEnv := wsfe.TESTING
	if s.cfg.Environment == "production" {
		wsfeEnv = wsfe.PRODUCTION
	}

	wsfeService := wsfe.NewService(wsfeEnv, token, sign)

	const puntoDeVenta = int32(1)
	const tipoComprobante = int32(wsfe.FacturaC) // Factura C = 11

	cabReq := &wsfe.CabRequest{
		Cuit:     s.cfg.CUIT,
		PtoVta:   puntoDeVenta,
		CbteTipo: tipoComprobante,
	}

	ultimoComp, err := wsfeService.GetUltimoComp(cabReq)
	if err != nil {
		return "", "", "", time.Time{}, fmt.Errorf("[AFIP] Error consultando último comprobante: %w", err)
	}
	nextComp := int64(ultimoComp) + 1
	log.Printf("[AFIP] Próximo número de comprobante: %d\n", nextComp)

	// ─── 3. WSFE: solicitar CAE ─────────────────────────────────────────────
	hoy := time.Now().Format("20060102")

	// Factura C no discrimina IVA: impTotal = impNeto, impIVA = 0
	impTotal := ticket.Total
	impNeto := impTotal

	detReq := &wsfe.CaeRequest{
		DocTipo:                99, // 99 = Consumidor final
		DocNro:                 0,
		CbteDesde:              nextComp,
		CbteHasta:              nextComp,
		CbteFch:                hoy,
		ImpTotal:               impTotal,
		ImpNeto:                impNeto,
		ImpOpEx:                0,
		ImpTotConc:             0,
		ImpTrib:                0,
		ImpIVA:                 0,
		CondicionIVAReceptorId: 5, // 5 = Consumidor final
	}

	cae, caeFchVto, err := wsfeService.CaeRequest(cabReq, detReq)
	if err != nil {
		return "", "", "", time.Time{}, fmt.Errorf("[AFIP] Error solicitando CAE: %w", err)
	}

	// Parsear fecha de vencimiento del CAE (formato AFIP: "YYYYMMDD")
	caeDue, err := time.Parse("20060102", caeFchVto)
	if err != nil {
		caeDue = time.Now().AddDate(0, 0, 10) // fallback
	}

	invType := "C"
	invNum := fmt.Sprintf("%04d-%08d", puntoDeVenta, nextComp)

	log.Printf("[AFIP] ✅ CAE emitido! Tipo: %s, Nro: %s, CAE: %s, Vto: %s\n",
		invType, invNum, cae, caeFchVto)

	// ─── 4. Persiste en DB ──────────────────────────────────────────────────
	if err := s.ticketRepo.UpdateAFIPFields(ctx, ticket.ID, invType, invNum, cae, caeDue); err != nil {
		return "", "", "", time.Time{}, fmt.Errorf("[AFIP] Error guardando campos en DB: %w", err)
	}

	ticket.InvoiceType = &invType
	ticket.InvoiceNumber = &invNum
	ticket.CAE = &cae
	ticket.CAEDueDate = &caeDue

	return invType, invNum, cae, caeDue, nil
}
