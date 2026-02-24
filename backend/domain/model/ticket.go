package model

import (
	"fmt"
	"time"
)

// TicketStatus represents the status of a ticket
type TicketStatus string

const (
	TicketStatusPending   TicketStatus = "pending"
	TicketStatusPaid      TicketStatus = "paid"
	TicketStatusCompleted TicketStatus = "completed"
	TicketStatusCancelled TicketStatus = "cancelled"
)

// PaymentMethod represents the payment method used
type PaymentMethod string

const (
	PaymentMethodCash          PaymentMethod = "cash"
	PaymentMethodCreditCard    PaymentMethod = "credit_card"
	PaymentMethodDebitCard     PaymentMethod = "debit_card"
	PaymentMethodDigitalWallet PaymentMethod = "digital_wallet"
)

// DefaultTaxRate is the default IVA tax rate (21% in Argentina)
const DefaultTaxRate = 21.0

// Ticket represents a sale/receipt
type Ticket struct {
	ID            int64         `json:"id"`
	UserID        int64         `json:"user_id"`
	TicketNumber  string        `json:"ticket_number"`
	Status        TicketStatus  `json:"status"`
	PaymentMethod PaymentMethod `json:"payment_method"`
	Subtotal      float64       `json:"subtotal"`
	TaxRate       float64       `json:"tax_rate"`
	TaxAmount     float64       `json:"tax_amount"`
	Total         float64       `json:"total"`
	Notes         string        `json:"notes,omitempty"`
	InvoiceType   *string       `json:"invoice_type,omitempty"`
	InvoiceNumber *string       `json:"invoice_number,omitempty"`
	CAE           *string       `json:"cae,omitempty"`
	CAEDueDate    *time.Time    `json:"cae_due_date,omitempty"`
	PaidAt        *time.Time    `json:"paid_at,omitempty"` // NULL mientras esté pending
	CompletedAt   *time.Time    `json:"completed_at,omitempty"`
	CancelledAt   *time.Time    `json:"cancelled_at,omitempty"`
	CreatedAt     time.Time     `json:"created_at"`
	UpdatedAt     time.Time     `json:"updated_at"`
}

// GenerateTicketNumber creates a unique ticket number
func GenerateTicketNumber() string {
	now := time.Now()
	return fmt.Sprintf("TKT-%d-%06d", now.Year(), now.UnixNano()%1000000)
}

// CalculateTotals computes subtotal, tax, and total from line items
func (t *Ticket) CalculateTotals(lines []TicketLine) {
	t.Subtotal = 0
	for _, line := range lines {
		t.Subtotal += line.Subtotal
	}

	if t.TaxRate == 0 {
		t.TaxRate = DefaultTaxRate
	}

	t.TaxAmount = t.Subtotal * (t.TaxRate / 100.0)
	t.Total = t.Subtotal + t.TaxAmount
}

// CanBeCompleted checks if ticket can be marked as completed
func (t *Ticket) CanBeCompleted() bool {
	return t.Status == TicketStatusPaid
}

// CanBeCancelled checks if ticket can be cancelled
func (t *Ticket) CanBeCancelled() bool {
	return t.Status == TicketStatusPaid || t.Status == TicketStatusCompleted || t.Status == TicketStatusPending
}

// MarkAsPaid marks a pending ticket as paid after MP payment confirmation
func (t *Ticket) MarkAsPaid() error {
	if t.Status != TicketStatusPending {
		return fmt.Errorf("ticket cannot be marked as paid from status: %s", t.Status)
	}
	now := time.Now()
	t.Status = TicketStatusPaid
	t.PaidAt = &now
	t.UpdatedAt = now
	return nil
}

// MarkAsCompleted marks the ticket as completed
func (t *Ticket) MarkAsCompleted() error {
	if !t.CanBeCompleted() {
		return fmt.Errorf("ticket cannot be completed in status: %s", t.Status)
	}
	now := time.Now()
	t.Status = TicketStatusCompleted
	t.CompletedAt = &now
	t.UpdatedAt = now
	return nil
}

// Cancel cancels the ticket
func (t *Ticket) Cancel() error {
	if !t.CanBeCancelled() {
		return fmt.Errorf("ticket cannot be cancelled in status: %s", t.Status)
	}
	now := time.Now()
	t.Status = TicketStatusCancelled
	t.CancelledAt = &now
	t.UpdatedAt = now
	return nil
}

// IsActive returns true if ticket is not cancelled
func (t *Ticket) IsActive() bool {
	return t.Status != TicketStatusCancelled
}
