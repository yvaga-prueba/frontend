package dto

import (
	"time"

	"core/domain/model"
)

// TicketItemRequest represents an item to add to a ticket
type TicketItemRequest struct {
	ProductID int64 `json:"product_id" example:"1"`
	Quantity  int   `json:"quantity" example:"2"`
}

// CreateTicketRequest is the request to create a new ticket
type CreateTicketRequest struct {
	Items         []TicketItemRequest `json:"items"`
	PaymentMethod model.PaymentMethod `json:"payment_method" example:"cash"`
	Notes         string              `json:"notes,omitempty" example:"Customer notes"`
}

// TicketLineResponse represents a ticket line item in responses
type TicketLineResponse struct {
	ID           int64     `json:"id" example:"1"`
	ProductID    int64     `json:"product_id" example:"1"`
	ProductTitle string    `json:"product_title" example:"Product Name"`
	ProductSize  string    `json:"product_size" example:"M"`
	Quantity     int       `json:"quantity" example:"2"`
	UnitPrice    float64   `json:"unit_price" example:"99.99"`
	Subtotal     float64   `json:"subtotal" example:"199.98"`
	CreatedAt    time.Time `json:"created_at"`
}

// TicketResponse represents a full ticket with line items
type TicketResponse struct {
	ID            int64                `json:"id" example:"1"`
	UserID        int64                `json:"user_id" example:"1"`
	TicketNumber  string               `json:"ticket_number" example:"TKT-2024-000001"`
	Status        model.TicketStatus   `json:"status" example:"paid"`
	PaymentMethod model.PaymentMethod  `json:"payment_method" example:"cash"`
	Subtotal      float64              `json:"subtotal" example:"199.98"`
	TaxRate       float64              `json:"tax_rate" example:"21.00"`
	TaxAmount     float64              `json:"tax_amount" example:"41.99"`
	Total         float64              `json:"total" example:"241.97"`
	Notes         string               `json:"notes,omitempty"`
	Lines         []TicketLineResponse `json:"lines"`
	PaidAt        *time.Time           `json:"paid_at,omitempty"`
	CompletedAt   *time.Time           `json:"completed_at,omitempty"`
	CancelledAt   *time.Time           `json:"cancelled_at,omitempty"`
	CreatedAt     time.Time            `json:"created_at"`
	UpdatedAt     time.Time            `json:"updated_at"`
}

// TicketSummaryResponse is a lightweight ticket response for lists
type TicketSummaryResponse struct {
	ID            int64               `json:"id" example:"1"`
	TicketNumber  string              `json:"ticket_number" example:"TKT-2024-000001"`
	Status        model.TicketStatus  `json:"status" example:"paid"`
	PaymentMethod model.PaymentMethod `json:"payment_method" example:"cash"`
	Total         float64             `json:"total" example:"241.97"`
	ItemCount     int                 `json:"item_count" example:"3"`
	CreatedAt     time.Time           `json:"created_at"`
}

// TicketReceiptResponse represents a printable receipt
type TicketReceiptResponse struct {
	TicketNumber  string               `json:"ticket_number" example:"TKT-2024-000001"`
	UserName      string               `json:"user_name" example:"John Doe"`
	UserEmail     string               `json:"user_email" example:"john@example.com"`
	Status        model.TicketStatus   `json:"status" example:"paid"`
	PaymentMethod model.PaymentMethod  `json:"payment_method" example:"cash"`
	Lines         []TicketLineResponse `json:"lines"`
	Subtotal      float64              `json:"subtotal" example:"199.98"`
	TaxRate       float64              `json:"tax_rate" example:"21.00"`
	TaxAmount     float64              `json:"tax_amount" example:"41.99"`
	Total         float64              `json:"total" example:"241.97"`
	Notes         string               `json:"notes,omitempty"`
	PaidAt        *time.Time           `json:"paid_at,omitempty"`
	CreatedAt     time.Time            `json:"created_at"`
}

// FromTicketLine converts a model.TicketLine to TicketLineResponse
func FromTicketLine(line model.TicketLine) TicketLineResponse {
	return TicketLineResponse{
		ID:           line.ID,
		ProductID:    line.ProductID,
		ProductTitle: line.ProductTitle,
		ProductSize:  line.ProductSize,
		Quantity:     line.Quantity,
		UnitPrice:    line.UnitPrice,
		Subtotal:     line.Subtotal,
		CreatedAt:    line.CreatedAt,
	}
}

// FromTicket converts a model.Ticket and lines to TicketResponse
func FromTicket(ticket model.Ticket, lines []model.TicketLine) TicketResponse {
	lineResponses := make([]TicketLineResponse, len(lines))
	for i, line := range lines {
		lineResponses[i] = FromTicketLine(line)
	}

	return TicketResponse{
		ID:            ticket.ID,
		UserID:        ticket.UserID,
		TicketNumber:  ticket.TicketNumber,
		Status:        ticket.Status,
		PaymentMethod: ticket.PaymentMethod,
		Subtotal:      ticket.Subtotal,
		TaxRate:       ticket.TaxRate,
		TaxAmount:     ticket.TaxAmount,
		Total:         ticket.Total,
		Notes:         ticket.Notes,
		Lines:         lineResponses,
		PaidAt:        ticket.PaidAt,
		CompletedAt:   ticket.CompletedAt,
		CancelledAt:   ticket.CancelledAt,
		CreatedAt:     ticket.CreatedAt,
		UpdatedAt:     ticket.UpdatedAt,
	}
}

// FromTicketSummary converts a model.Ticket to TicketSummaryResponse
func FromTicketSummary(ticket model.Ticket, itemCount int) TicketSummaryResponse {
	return TicketSummaryResponse{
		ID:            ticket.ID,
		TicketNumber:  ticket.TicketNumber,
		Status:        ticket.Status,
		PaymentMethod: ticket.PaymentMethod,
		Total:         ticket.Total,
		ItemCount:     itemCount,
		CreatedAt:     ticket.CreatedAt,
	}
}
