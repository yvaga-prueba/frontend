package service

import (
	"context"
	"fmt"
	"log"
	"time"

	"core/domain/model"
	"core/domain/repo"
)

// fireAndLogInvoice dispara GenerateInvoice en background y loguea el resultado.
// Antes los `go afipService.GenerateInvoice(...)` sueltos descartaban los errores
// silenciosamente, haciendo imposible diagnosticar fallos en producción.
func fireAndLogInvoice(afipSvc AfipService, ticket *model.Ticket) {
	go func() {
		_, _, cae, _, err := afipSvc.GenerateInvoice(context.Background(), ticket)
		if err != nil {
			log.Printf("[AFIP] ❌ Error al generar factura para ticket %s: %v", ticket.TicketNumber, err)
			return
		}
		if cae != "" {
			log.Printf("[AFIP] ✅ Factura generada en background para ticket %s — CAE: %s", ticket.TicketNumber, cae)
		}
	}()
}

// TicketService defines the business logic for ticket management
type TicketService interface {
	CreateTicket(ctx context.Context, userID int64, items []TicketItemRequest, paymentMethod model.PaymentMethod, notes string, status model.TicketStatus, couponCode string, clientName string, clientEmail string) (*model.Ticket, []model.TicketLine, error)
	GetTicketByID(ctx context.Context, ticketID int64) (*model.Ticket, []model.TicketLine, error)
	GetTicketByNumber(ctx context.Context, ticketNumber string) (*model.Ticket, []model.TicketLine, error)
	GetUserTickets(ctx context.Context, userID int64, filter repo.TicketFilter) ([]model.Ticket, error)
	ListTickets(ctx context.Context, filter repo.TicketFilter) ([]model.Ticket, error)
	MarkAsPaid(ctx context.Context, ticketID int64) error
	CompleteTicket(ctx context.Context, ticketID int64) error
	CancelTicket(ctx context.Context, ticketID int64) error
	UpdateTrackingNumber(ctx context.Context, ticketID int64, trackingNumber string) error
}

// TicketItemRequest represents an item to add to a ticket
type TicketItemRequest struct {
	ProductID int64
	Quantity  int
}

type ticketServiceImpl struct {
	ticketRepo     repo.TicketRepository
	ticketLineRepo repo.TicketLineRepository
	productRepo    repo.ProductRepository
	afipService    AfipService
	sellerRepo     repo.SellerRepository
}

// NewTicketService creates a new ticket service
func NewTicketService(
	ticketRepo repo.TicketRepository,
	ticketLineRepo repo.TicketLineRepository,
	productRepo repo.ProductRepository,
	afipService AfipService,
	sellerRepo repo.SellerRepository,
) TicketService {
	return &ticketServiceImpl{
		ticketRepo:     ticketRepo,
		ticketLineRepo: ticketLineRepo,
		productRepo:    productRepo,
		afipService:    afipService,
		sellerRepo:     sellerRepo,
	}
}

// CreateTicket creates a new ticket (reduces stock immediately to reserve inventory)
func (s *ticketServiceImpl) CreateTicket(
	ctx context.Context,
	userID int64,
	items []TicketItemRequest,
	paymentMethod model.PaymentMethod,
	notes string,
	initialStatus model.TicketStatus,
	couponCode string,
	clientName string,   // nuevo
	clientEmail string,  // nuevo
) (*model.Ticket, []model.TicketLine, error) {
	if len(items) == 0 {
		return nil, nil, fmt.Errorf("ticket must have at least one item")
	}

	// Validate stock and get products
	var lines []model.TicketLine
	for _, item := range items {
		if item.Quantity <= 0 {
			return nil, nil, fmt.Errorf("quantity must be greater than 0")
		}

		product, err := s.productRepo.GetByID(ctx, item.ProductID)
		if err != nil {
			return nil, nil, fmt.Errorf("product %d not found: %w", item.ProductID, err)
		}

		// Check stock availability
		if product.Stock < int64(item.Quantity) {
			return nil, nil, fmt.Errorf("insufficient stock for product '%s': available %d, requested %d",
				product.Title, product.Stock, item.Quantity)
		}

		// Create line with product snapshot
		line := model.NewTicketLine(0, product, item.Quantity)
		lines = append(lines, *line)
	}

	if initialStatus == "" {
		initialStatus = model.TicketStatusPaid
	}

	// paid_at solo se setea si el ticket nace como pagado
	now := time.Now()
	var paidAt *time.Time
	if initialStatus == model.TicketStatusPaid {
		paidAt = &now
	}

	ticket := &model.Ticket{
        UserID:        userID,
        TicketNumber:  model.GenerateTicketNumber(),
        Status:        initialStatus,
        PaymentMethod: paymentMethod,
        TaxRate:       model.DefaultTaxRate,
        Notes:         notes,
        CouponCode:    couponCode, 
        PaidAt:        paidAt,
		ClientName:    clientName,   //nuevos campos 
		ClientEmail:   clientEmail,  
		ClientContact: "-",          
        CreatedAt:     now,
        UpdatedAt:     now,
    }

    //  Calculamos los totales base (subtotal, etc)
    ticket.CalculateTotals(lines)

    
    // Logicade descuento
    var discountPercentage float64 = 0.0
    var textoCupon string = couponCode

    // Check Primera Compra (3%)
    userTickets, _ := s.ticketRepo.ListByUserID(ctx, userID, repo.TicketFilter{Limit: 1})
    if len(userTickets) == 0 {
        discountPercentage += 0.03
        if textoCupon == "" {
            textoCupon = "1RA COMPRA"
        } else {
            textoCupon = textoCupon + " + 1RA COMPRA"
        }
    }

   // Check Cupón de Vendedor (Dinámico desde la BD)
	if couponCode != "" {
		seller, err := s.sellerRepo.GetByCode(ctx, couponCode)
		if err == nil && seller != nil {
			// Cupón válido: sumamos su descuento real y guardamos su nombre
			discountPercentage += seller.DiscountPercentage
			ticket.SellerName = seller.GetFullName()
		} else {
			// Si pone un código que no existe o el vendedor está inactivo
			return nil, nil, fmt.Errorf("el cupón ingresado no existe o no está activo")
		}
	} else {
		ticket.SellerName = "Venta Online"
	}

    ticket.CouponCode = textoCupon

    // Si hay algún descuento, recalculamos el total
    if discountPercentage > 0 {
        ticket.TaxAmount = ticket.Subtotal * discountPercentage
        ticket.Total = ticket.Subtotal - ticket.TaxAmount
    } else {
        ticket.TaxAmount = 0
        ticket.Total = ticket.Subtotal
        ticket.CouponCode = "-"
    }
    // fin logica de desc

    // 2. Guardamos el ticket ya con el descuento aplicado
    if err := s.ticketRepo.Create(ctx, ticket); err != nil {
        return nil, nil, fmt.Errorf("failed to create ticket: %w", err)
    }

	// Update line ticket IDs and save
	for i := range lines {
		lines[i].TicketID = ticket.ID
	}

	if err := s.ticketLineRepo.CreateBatch(ctx, lines); err != nil {
		return nil, nil, fmt.Errorf("failed to create ticket lines: %w", err)
	}

	// Reduce stock for each product (reserva inmediata)
	for _, item := range items {
		if err := s.productRepo.UpdateStock(ctx, item.ProductID, -int64(item.Quantity)); err != nil {
			return nil, nil, fmt.Errorf("failed to update stock for product %d: %w", item.ProductID, err)
		}
	}

	// Si el pago es en efectivo (inmediatamente pagado), generamos factura en AFIP
	if ticket.Status == model.TicketStatusPaid && s.afipService != nil {
		fireAndLogInvoice(s.afipService, ticket)
	}

	return ticket, lines, nil
}

// MarkAsPaid transitions a pending ticket to paid after MP confirms the payment
func (s *ticketServiceImpl) MarkAsPaid(ctx context.Context, ticketID int64) error {
	err := s.ticketRepo.MarkAsPaid(ctx, ticketID)
	if err != nil {
		return err
	}

	ticket, _, err := s.GetTicketByID(ctx, ticketID)
	if err == nil && ticket != nil && s.afipService != nil {
		// Generamos la factura en segundo plano tras confirmar pago por Mercado Pago
		fireAndLogInvoice(s.afipService, ticket)
	}

	return nil
}

// GetTicketByID retrieves a ticket with its lines
func (s *ticketServiceImpl) GetTicketByID(ctx context.Context, ticketID int64) (*model.Ticket, []model.TicketLine, error) {
	ticket, err := s.ticketRepo.GetByID(ctx, ticketID)
	if err != nil {
		return nil, nil, err
	}

	lines, err := s.ticketLineRepo.GetByTicketID(ctx, ticketID)
	if err != nil {
		return nil, nil, err
	}

	return ticket, lines, nil
}

// GetTicketByNumber retrieves a ticket by its ticket number
func (s *ticketServiceImpl) GetTicketByNumber(ctx context.Context, ticketNumber string) (*model.Ticket, []model.TicketLine, error) {
	ticket, err := s.ticketRepo.GetByTicketNumber(ctx, ticketNumber)
	if err != nil {
		return nil, nil, err
	}

	lines, err := s.ticketLineRepo.GetByTicketID(ctx, ticket.ID)
	if err != nil {
		return nil, nil, err
	}

	return ticket, lines, nil
}

// GetUserTickets retrieves all tickets for a user
func (s *ticketServiceImpl) GetUserTickets(ctx context.Context, userID int64, filter repo.TicketFilter) ([]model.Ticket, error) {
	return s.ticketRepo.ListByUserID(ctx, userID, filter)
}

// ListTickets retrieves all tickets (admin)
func (s *ticketServiceImpl) ListTickets(ctx context.Context, filter repo.TicketFilter) ([]model.Ticket, error) {
	return s.ticketRepo.List(ctx, filter)
}

// CompleteTicket marks a ticket as completed
func (s *ticketServiceImpl) CompleteTicket(ctx context.Context, ticketID int64) error {
	ticket, err := s.ticketRepo.GetByID(ctx, ticketID)
	if err != nil {
		return err
	}

	if err := ticket.MarkAsCompleted(); err != nil {
		return err
	}

	return s.ticketRepo.Update(ctx, ticket)
}

// CancelTicket cancels a ticket and restores stock
func (s *ticketServiceImpl) CancelTicket(ctx context.Context, ticketID int64) error {
	ticket, err := s.ticketRepo.GetByID(ctx, ticketID)
	if err != nil {
		return err
	}

	if err := ticket.Cancel(); err != nil {
		return err
	}

	// Get ticket lines to restore stock
	lines, err := s.ticketLineRepo.GetByTicketID(ctx, ticketID)
	if err != nil {
		return fmt.Errorf("failed to get ticket lines: %w", err)
	}

	// Restore stock for each product
	for _, line := range lines {
		if err := s.productRepo.UpdateStock(ctx, line.ProductID, int64(line.Quantity)); err != nil {
			return fmt.Errorf("failed to restore stock for product %d: %w", line.ProductID, err)
		}
	}

	return s.ticketRepo.Update(ctx, ticket)
}

// UpdateTrackingNumber adds or updates the tracking number for a ticket
func (s *ticketServiceImpl) UpdateTrackingNumber(ctx context.Context, ticketID int64, trackingNumber string) error {
	ticket, err := s.ticketRepo.GetByID(ctx, ticketID)
	if err != nil {
		return err
	}

	trimmedTracking := trackingNumber
	if trimmedTracking == "" {
		ticket.TrackingNumber = nil
	} else {
		ticket.TrackingNumber = &trimmedTracking
	}

	ticket.UpdatedAt = time.Now()

	return s.ticketRepo.Update(ctx, ticket)
}
