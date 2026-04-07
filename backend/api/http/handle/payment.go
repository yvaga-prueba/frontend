package handle

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"

	"core/api/dto"
	"core/config"
	"core/domain/model"
	"core/domain/service"

	"github.com/labstack/echo/v4"
)

// PaymentHandler maneja la creación de preferencias de MercadoPago
// y provee información de transferencia bancaria.
type PaymentHandler struct {
	ticketService service.TicketService
	cfg           config.Config
}

func NewPaymentHandler(ticketService service.TicketService, cfg config.Config) *PaymentHandler {
	return &PaymentHandler{ticketService: ticketService, cfg: cfg}
}

// ── MercadoPago types ─────────────────────────────────────────────────────────

type mpItem struct {
	ID         string  `json:"id"`
	Title      string  `json:"title"`
	Quantity   int     `json:"quantity"`
	UnitPrice  float64 `json:"unit_price"`
	CurrencyID string  `json:"currency_id"`
}

type mpPaymentMethods struct {
	ExcludedPaymentTypes []mpType `json:"excluded_payment_types,omitempty"`
	Installments         int      `json:"installments,omitempty"`
	DefaultInstallments  int      `json:"default_installments,omitempty"`
}

type mpType struct {
	ID string `json:"id"`
}

type mpBackURLs struct {
	Success string `json:"success"`
	Failure string `json:"failure"`
	Pending string `json:"pending"`
}

type mpPreferenceRequest struct {
	Items            []mpItem         `json:"items"`
	BackURLs         mpBackURLs       `json:"back_urls"`
	AutoReturn       string           `json:"auto_return"`
	PaymentMethods   mpPaymentMethods `json:"payment_methods"`
	ExternalRef      string           `json:"external_reference"`
	Expires          bool             `json:"expires"`
	ExpirationDateTo string           `json:"expiration_date_to,omitempty"`
}

type mpPreferenceResponse struct {
	ID         string `json:"id"`
	InitPoint  string `json:"init_point"`
	SandboxURL string `json:"sandbox_init_point"`
}

// ── Request/Response tipos de payload ─────────────────────────────────────────

type CreatePreferenceRequest struct {
	Items         []dto.TicketItemRequest `json:"items"`
	PaymentMethod string                  `json:"payment_method"` // "card" | "transfer" | "cash"
	Notes         string                  `json:"notes,omitempty"`
	ClientName    string                  `json:"client_name"`  
	ClientEmail   string                  `json:"client_email"`
	CouponCode    string                  `json:"coupon_code,omitempty"` 
	ClientDNI     string                  `json:"client_dni"`     // 
	ClientContact string                  `json:"client_contact"` // 
}

type CreatePreferenceResponse struct {
	// Para "card": URL de redirección a MercadoPago
	RedirectURL string `json:"redirect_url,omitempty"`
	// Para "transfer": datos bancarios
	CBU         string  `json:"cbu,omitempty"`
	Alias       string  `json:"alias,omitempty"`
	BankName    string  `json:"bank_name,omitempty"`
	AccountName string  `json:"account_name,omitempty"`
	Amount      float64 `json:"amount,omitempty"`
	// Número de ticket creado (para transfer/cash inmediato)
	TicketNumber string `json:"ticket_number,omitempty"`
	TicketID     int64  `json:"ticket_id,omitempty"`
}

// CreatePreference godoc
// @Summary      Crear preferencia de pago
// @Description  Para tarjeta: crea preference en MP y devuelve redirect URL.
//
//	Para transferencia / efectivo: crea el ticket y devuelve datos de pago.
//
// @Tags         payments
// @Accept       json
// @Produce      json
// @Param        body  body      CreatePreferenceRequest  true  "Payment data"
// @Success      200   {object}  CreatePreferenceResponse
// @Failure      400   {object}  map[string]string
// @Security     BearerAuth
// @Router       /api/payments/preference [post]
func (h *PaymentHandler) CreatePreference(c echo.Context) error {
	ctx := c.Request().Context()

	userID := getUserIDFromContext(c)
	if userID == 0 {
		return c.JSON(http.StatusUnauthorized, map[string]string{"error": "unauthorized"})
	}

	var req CreatePreferenceRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid request body"})
	}
	if len(req.Items) == 0 {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "se requiere al menos un item"})
	}

	// Mapear items al formato del servicio de tickets
	svcItems := make([]service.TicketItemRequest, len(req.Items))
	for i, item := range req.Items {
		svcItems[i] = service.TicketItemRequest{
			ProductID: item.ProductID,
			Quantity:  item.Quantity,
		}
	}

	//  PASAMOS EL DNI Y CONTACTO A LAS FUNCIONES
	switch req.PaymentMethod {
	case "card":
		return h.handleCardPayment(c, ctx, userID, svcItems, req.Notes, req.CouponCode, req.ClientName, req.ClientEmail, req.ClientDNI, req.ClientContact)
	case "transfer":
		return h.handleTransferPayment(c, ctx, userID, svcItems, req.Notes, req.CouponCode, req.ClientName, req.ClientEmail, req.ClientDNI, req.ClientContact)
	case "cash":
		return h.handleCashPayment(c, ctx, userID, svcItems, req.Notes, req.CouponCode, req.ClientName, req.ClientEmail, req.ClientDNI, req.ClientContact)
	default:
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "método de pago inválido: usar card, transfer o cash"})
	}
}

// mapPaymentMethod convierte los valores del frontend a los valores del ENUM de MySQL
func mapPaymentMethod(frontendMethod string) (model.PaymentMethod, error) {
	switch frontendMethod {
	case "card":
		return model.PaymentMethodCreditCard, nil // ENUM: 'credit_card'
	case "transfer":
		return model.PaymentMethodDigitalWallet, nil // ENUM: 'digital_wallet'
	case "cash":
		return model.PaymentMethodCash, nil // ENUM: 'cash'
	default:
		return "", fmt.Errorf("método de pago inválido: %s", frontendMethod)
	}
}

//  AGREGAMOS clientDNI y clientContact a la firma
func (h *PaymentHandler) handleCardPayment(
	c echo.Context, ctx context.Context,
	userID int64, items []service.TicketItemRequest, notes string, couponCode string, clientName string, clientEmail string, clientDNI string, clientContact string,
) error {
	if !h.cfg.MercadoPago.Enabled {
		return c.JSON(http.StatusServiceUnavailable, map[string]string{
			"error": "el pago con tarjeta no está configurado en este momento",
		})
	}

	payMethod, err := mapPaymentMethod("card")
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": err.Error()})
	}

	//  SE LO PASAMOS A CREATETICKET
	ticket, lines, err := h.ticketService.CreateTicket(ctx, userID, items, payMethod, notes, model.TicketStatusPending, couponCode, clientName, clientEmail, clientDNI, clientContact)
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": err.Error()})
	}

	// Calculamos el descuento interno para pasárselo a MP
	discountPct := 0.0
	if ticket.Subtotal > 0 && ticket.TaxAmount > 0 {
		discountPct = ticket.TaxAmount / ticket.Subtotal
	}

	// Construir items para MP
	mpItems := make([]mpItem, len(lines))
	for i, line := range lines {
		mpItems[i] = mpItem{
			ID:         fmt.Sprintf("product-%d", line.ProductID),
			Title:      line.ProductTitle,
			Quantity:   line.Quantity,
			UnitPrice:  line.UnitPrice * (1.0 - discountPct), // Aca se aplica la rebaja al precio que MP nos va a cobrar
			CurrencyID: "ARS",
		}
	}

	successURL := fmt.Sprintf("%s?ticket_id=%d&status=approved", h.cfg.MercadoPago.SuccessURL, ticket.ID)
	failureURL := fmt.Sprintf("%s?ticket_id=%d&status=failed", h.cfg.MercadoPago.FailureURL, ticket.ID)
	pendingURL := fmt.Sprintf("%s?ticket_id=%d&status=pending", h.cfg.MercadoPago.PendingURL, ticket.ID)

	autoReturn := ""
	if strings.HasPrefix(h.cfg.MercadoPago.SuccessURL, "https://") {
		autoReturn = "approved"
	}

	prefReq := mpPreferenceRequest{
		Items: mpItems,
		BackURLs: mpBackURLs{
			Success: successURL,
			Failure: failureURL,
			Pending: pendingURL,
		},
		AutoReturn: autoReturn,
		PaymentMethods: mpPaymentMethods{
			ExcludedPaymentTypes: []mpType{
				{ID: "ticket"},
				{ID: "bank_transfer"},
				{ID: "atm"},
				{ID: "crypto"},
			},
			Installments:        12, 
			DefaultInstallments: 1,
		},
		ExternalRef:      fmt.Sprintf("ticket-%d", ticket.ID),
		Expires:          true,
		ExpirationDateTo: time.Now().Add(24 * time.Hour).UTC().Format(time.RFC3339),
	}

	initPoint, err := h.createMPPreference(prefReq)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "no se pudo crear la preferencia de pago: " + err.Error()})
	}

	return c.JSON(http.StatusOK, CreatePreferenceResponse{
		RedirectURL:  initPoint,
		TicketNumber: ticket.TicketNumber,
		TicketID:     ticket.ID,
	})
}

//  agreagmos dni y contacto a la firma
func (h *PaymentHandler) handleTransferPayment(
	c echo.Context, ctx context.Context,
	userID int64, items []service.TicketItemRequest, notes string, couponCode string, clientName string, clientEmail string, clientDNI string, clientContact string,
) error {
	if !h.cfg.MercadoPago.Enabled {
		return c.JSON(http.StatusServiceUnavailable, map[string]string{
			"error": "el pago por transferencia no está configurado en este momento",
		})
	}

	payMethod, err := mapPaymentMethod("transfer")
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": err.Error()})
	}

	// SE LO PASAMOS A CREATETICKET
	ticket, lines, err := h.ticketService.CreateTicket(ctx, userID, items, payMethod, notes, model.TicketStatusPending, couponCode, clientName, clientEmail, clientDNI, clientContact)
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": err.Error()})
	}

	// Calculamos el descuento interno para pasárselo a MP
	discountPct := 0.0
	if ticket.Subtotal > 0 && ticket.TaxAmount > 0 {
		discountPct = ticket.TaxAmount / ticket.Subtotal
	}

	// Construir items para MP
	mpItems := make([]mpItem, len(lines))
	for i, line := range lines {
		mpItems[i] = mpItem{
			ID:         fmt.Sprintf("product-%d", line.ProductID),
			Title:      line.ProductTitle,
			Quantity:   line.Quantity,
			UnitPrice:  line.UnitPrice * (1.0 - discountPct), // Aca se aplica la rebaja al precio que MP nos va a cobrar
			CurrencyID: "ARS",
		}
	}

	successURL := fmt.Sprintf("%s?ticket_id=%d&status=approved", h.cfg.MercadoPago.SuccessURL, ticket.ID)
	failureURL := fmt.Sprintf("%s?ticket_id=%d&status=failed", h.cfg.MercadoPago.FailureURL, ticket.ID)
	pendingURL := fmt.Sprintf("%s?ticket_id=%d&status=pending", h.cfg.MercadoPago.PendingURL, ticket.ID)

	autoReturn := ""
	if strings.HasPrefix(h.cfg.MercadoPago.SuccessURL, "https://") {
		autoReturn = "approved"
	}

	prefReq := mpPreferenceRequest{
		Items: mpItems,
		BackURLs: mpBackURLs{
			Success: successURL,
			Failure: failureURL,
			Pending: pendingURL,
		},
		AutoReturn: autoReturn,
		PaymentMethods: mpPaymentMethods{
			ExcludedPaymentTypes: []mpType{
				{ID: "credit_card"},
				{ID: "debit_card"},
				{ID: "ticket"}, 
				{ID: "atm"},
				{ID: "digital_currency"},
				{ID: "digital_wallet"},
			},
		},
		ExternalRef:      fmt.Sprintf("ticket-%d", ticket.ID),
		Expires:          true,
		ExpirationDateTo: time.Now().Add(48 * time.Hour).UTC().Format(time.RFC3339),
	}

	initPoint, err := h.createMPPreference(prefReq)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{
			"error": "no se pudo crear la preferencia de pago: " + err.Error(),
		})
	}

	return c.JSON(http.StatusOK, CreatePreferenceResponse{
		RedirectURL:  initPoint,
		TicketNumber: ticket.TicketNumber,
		TicketID:     ticket.ID,
	})
}

// agregamos dni y contacto a la firma   
func (h *PaymentHandler) handleCashPayment(
	c echo.Context, ctx context.Context,
	userID int64, items []service.TicketItemRequest, notes string, couponCode string, clientName string, clientEmail string, clientDNI string, clientContact string,
) error {
	payMethod, err := mapPaymentMethod("cash")
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": err.Error()})
	}

	// SE LO PASAMOS A CREATETICKET
	ticket, _, err := h.ticketService.CreateTicket(ctx, userID, items, payMethod, notes, model.TicketStatusPaid, couponCode, clientName, clientEmail, clientDNI, clientContact)
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": err.Error()})
	}

	return c.JSON(http.StatusOK, CreatePreferenceResponse{
		TicketNumber: ticket.TicketNumber,
		TicketID:     ticket.ID,
	})
}

// ── MercadoPago API call ──────────────────────────────────────────────────────

func (h *PaymentHandler) createMPPreference(req mpPreferenceRequest) (string, error) {
	body, err := json.Marshal(req)
	if err != nil {
		return "", err
	}

	httpReq, err := http.NewRequest("POST", "https://api.mercadopago.com/checkout/preferences", bytes.NewReader(body))
	if err != nil {
		return "", err
	}
	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("Authorization", "Bearer "+h.cfg.MercadoPago.AccessToken)

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(httpReq)
	if err != nil {
		return "", fmt.Errorf("error comunicando con MercadoPago: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		var mpErr map[string]interface{}
		json.NewDecoder(resp.Body).Decode(&mpErr)
		return "", fmt.Errorf("MercadoPago respondió %d: %v", resp.StatusCode, mpErr)
	}

	var prefResp mpPreferenceResponse
	if err := json.NewDecoder(resp.Body).Decode(&prefResp); err != nil {
		return "", fmt.Errorf("error decodificando respuesta de MP: %w", err)
	}

	if prefResp.InitPoint == "" {
		return "", fmt.Errorf("MP no devolvió init_point")
	}
	return prefResp.InitPoint, nil
}

// ── Webhook de MercadoPago ────────────────────────────────────────────────────

type mpWebhookPayload struct {
	Action string `json:"action"` // "payment.created", "payment.updated"
	Type   string `json:"type"`   // "payment"
	Data   struct {
		ID string `json:"id"` // payment ID en MP
	} `json:"data"`
}

type mpPaymentDetail struct {
	ID                int64   `json:"id"`
	Status            string  `json:"status"` // "approved", "pending", "rejected"
	StatusDetail      string  `json:"status_detail"`
	ExternalReference string  `json:"external_reference"` // "ticket-{id}"
	TransactionAmount float64 `json:"transaction_amount"`
}

// MPWebhook godoc
// @Summary      Webhook de MercadoPago
// @Description  Recibe notificaciones de pago de MP y actualiza el estado del ticket a 'paid'
// @Tags         payments
// @Accept       json
// @Produce      json
// @Success      200
// @Router       /api/payments/webhook [post]
func (h *PaymentHandler) MPWebhook(c echo.Context) error {
	ctx := c.Request().Context()

	var payload mpWebhookPayload
	if err := c.Bind(&payload); err != nil {
		// MP también envía notificaciones vía query params (IPN legacy)
		paymentID := c.QueryParam("id")
		dataID := c.QueryParam("data.id")
		if paymentID == "" {
			paymentID = dataID
		}
		if paymentID != "" {
			return h.processPayment(c, ctx, paymentID)
		}
		return c.JSON(http.StatusOK, map[string]string{"status": "ignored"})
	}

	if payload.Type != "payment" || payload.Data.ID == "" {
		return c.JSON(http.StatusOK, map[string]string{"status": "ignored"})
	}

	return h.processPayment(c, ctx, payload.Data.ID)
}

func (h *PaymentHandler) processPayment(c echo.Context, ctx context.Context, paymentID string) error {
	if !h.cfg.MercadoPago.Enabled {
		return c.JSON(http.StatusOK, map[string]string{"status": "skipped"})
	}

	mpURL := fmt.Sprintf("https://api.mercadopago.com/v1/payments/%s", paymentID)
	req, err := http.NewRequest("GET", mpURL, nil)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "error building request"})
	}
	req.Header.Set("Authorization", "Bearer "+h.cfg.MercadoPago.AccessToken)

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "error contacting MP"})
	}
	defer resp.Body.Close()

	var detail mpPaymentDetail
	if err := json.NewDecoder(resp.Body).Decode(&detail); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "error decoding MP response"})
	}

	if detail.Status != "approved" {
		return c.JSON(http.StatusOK, map[string]string{
			"status":    "not_approved",
			"mp_status": detail.Status,
		})
	}

	ticketID, err := extractTicketID(detail.ExternalReference)
	if err != nil {
		return c.JSON(http.StatusOK, map[string]string{
			"status": "unknown_reference",
			"ref":    detail.ExternalReference,
		})
	}

	if err := h.ticketService.MarkAsPaid(ctx, ticketID); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "error updating ticket"})
	}

	return c.JSON(http.StatusOK, map[string]string{
		"status":    "ok",
		"ticket_id": fmt.Sprintf("%d", ticketID),
	})
}

func extractTicketID(ref string) (int64, error) {
	var id int64
	_, err := fmt.Sscanf(ref, "ticket-%d", &id)
	if err != nil || id == 0 {
		return 0, fmt.Errorf("invalid external_reference: %q", ref)
	}
	return id, nil
}