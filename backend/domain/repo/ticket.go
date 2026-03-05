package repo

import (
	"context"
	"time"

	"core/domain/model"
)

// TicketFilter contains filtering options for ticket queries
type TicketFilter struct {
	Status      model.TicketStatus
	UserID      int64
	DateFrom    string // YYYY-MM-DD
	DateTo      string // YYYY-MM-DD
	OnlyWithCAE bool   // Filter only those with CAE
	Limit       int
	Offset      int
}

// TicketRepository defines the interface for ticket data access
type TicketRepository interface {
	Create(ctx context.Context, ticket *model.Ticket) error
	GetByID(ctx context.Context, id int64) (*model.Ticket, error)
	GetByTicketNumber(ctx context.Context, ticketNumber string) (*model.Ticket, error)
	ListByUserID(ctx context.Context, userID int64, filter TicketFilter) ([]model.Ticket, error)
	List(ctx context.Context, filter TicketFilter) ([]model.Ticket, error)
	Update(ctx context.Context, ticket *model.Ticket) error
	UpdateAFIPFields(ctx context.Context, ticketID int64, invType, invNum, cae string, caeDue time.Time) error
	MarkAsPaid(ctx context.Context, ticketID int64) error
	Delete(ctx context.Context, id int64) error
}
