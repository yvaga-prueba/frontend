package service

import (
	"context"
	"fmt"
	"time"

	"core/domain/model"
	"core/domain/repo"
)

// TicketService defines the business logic for ticket management
type TicketService interface {
	CreateTicket(ctx context.Context, userID int64, items []TicketItemRequest, paymentMethod model.PaymentMethod, notes string, initialStatus model.TicketStatus) (*model.Ticket, []model.TicketLine, error)
	GetTicketByID(ctx context.Context, ticketID int64) (*model.Ticket, []model.TicketLine, error)
	GetTicketByNumber(ctx context.Context, ticketNumber string) (*model.Ticket, []model.TicketLine, error)
	GetUserTickets(ctx context.Context, userID int64, filter repo.TicketFilter) ([]model.Ticket, error)
	ListTickets(ctx context.Context, filter repo.TicketFilter) ([]model.Ticket, error)
	MarkAsPaid(ctx context.Context, ticketID int64) error
	CompleteTicket(ctx context.Context, ticketID int64) error
	CancelTicket(ctx context.Context, ticketID int64) error
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
}

// NewTicketService creates a new ticket service
func NewTicketService(
	ticketRepo repo.TicketRepository,
	ticketLineRepo repo.TicketLineRepository,
	productRepo repo.ProductRepository,
) TicketService {
	return &ticketServiceImpl{
		ticketRepo:     ticketRepo,
		ticketLineRepo: ticketLineRepo,
		productRepo:    productRepo,
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
		PaidAt:        paidAt,
		CreatedAt:     now,
		UpdatedAt:     now,
	}

	// Calculate totals
	ticket.CalculateTotals(lines)

	// Save ticket
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

	return ticket, lines, nil
}

// MarkAsPaid transitions a pending ticket to paid after MP confirms the payment
func (s *ticketServiceImpl) MarkAsPaid(ctx context.Context, ticketID int64) error {
	return s.ticketRepo.MarkAsPaid(ctx, ticketID)
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
