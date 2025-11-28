package model

import "time"

// TicketLine represents a line item in a ticket
type TicketLine struct {
	ID           int64     `json:"id"`
	TicketID     int64     `json:"ticket_id"`
	ProductID    int64     `json:"product_id"`
	ProductTitle string    `json:"product_title"` // Snapshot at time of sale
	ProductSize  string    `json:"product_size"`  // Snapshot at time of sale
	Quantity     int       `json:"quantity"`
	UnitPrice    float64   `json:"unit_price"` // Snapshot at time of sale
	Subtotal     float64   `json:"subtotal"`
	CreatedAt    time.Time `json:"created_at"`
}

// CalculateSubtotal computes the subtotal for this line
func (tl *TicketLine) CalculateSubtotal() {
	tl.Subtotal = float64(tl.Quantity) * tl.UnitPrice
}

// NewTicketLine creates a new ticket line from product data
func NewTicketLine(ticketID int64, product *Product, quantity int) *TicketLine {
	line := &TicketLine{
		TicketID:     ticketID,
		ProductID:    product.ID,
		ProductTitle: product.Title,
		ProductSize:  product.Size,
		Quantity:     quantity,
		UnitPrice:    product.UnitPrice,
		CreatedAt:    time.Now(),
	}
	line.CalculateSubtotal()
	return line
}
