package repo

import (
	"context"
	"core/domain/model"
)

// TicketLineRepository defines the interface for ticket line data access
type TicketLineRepository interface {
	Create(ctx context.Context, line *model.TicketLine) error
	CreateBatch(ctx context.Context, lines []model.TicketLine) error
	GetByTicketID(ctx context.Context, ticketID int64) ([]model.TicketLine, error)
	Update(ctx context.Context, line *model.TicketLine) error
	Delete(ctx context.Context, id int64) error
	DeleteByTicketID(ctx context.Context, ticketID int64) error
}
