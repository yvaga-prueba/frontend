package entity

import (
	"context"
	"database/sql"
	"fmt"
	"strings"
	"time"

	errorcode "core/api/error_code"
	"core/domain/model"
	"core/domain/repo"
)

type TicketRepo struct {
	DB *sql.DB
}

func NewTicketRepository(db *sql.DB) repo.TicketRepository {
	return &TicketRepo{DB: db}
}

var _ repo.TicketRepository = (*TicketRepo)(nil)

func (r *TicketRepo) Create(ctx context.Context, ticket *model.Ticket) error {
	query := `
		INSERT INTO tickets (user_id, ticket_number, status, payment_method, subtotal, tax_rate, tax_amount, total, notes, tracking_number, seller_name, client_name, client_email, client_dni, client_contact, coupon_code, paid_at, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	`
	var paidAt sql.NullTime
	if ticket.PaidAt != nil {
		paidAt = sql.NullTime{Time: *ticket.PaidAt, Valid: true}
	}
	res, err := r.DB.ExecContext(ctx, query,
		ticket.UserID,
		ticket.TicketNumber,
		ticket.Status,
		ticket.PaymentMethod,
		ticket.Subtotal,
		ticket.TaxRate,
		ticket.TaxAmount,
		ticket.Total,
		ticket.Notes,
		ticket.TrackingNumber,
		ticket.SellerName,
		ticket.ClientName,
		ticket.ClientEmail,
		ticket.ClientDNI,     // <-- NUEVO: DNI agregado al insert
		ticket.ClientContact,
		ticket.CouponCode,
		paidAt,
		ticket.CreatedAt,
		ticket.UpdatedAt,
	)
	if err != nil {
		return err
	}
	id, _ := res.LastInsertId()
	ticket.ID = id
	return nil
}

func (r *TicketRepo) GetByID(ctx context.Context, id int64) (*model.Ticket, error) {
	// IMPORTANTE: Le agregamos client_dni a la lectura
	query := `
		SELECT id, user_id, ticket_number, status, payment_method, subtotal, tax_rate, tax_amount, total, notes, invoice_type, invoice_number, cae, cae_due_date, tracking_number, seller_name, client_name, client_dni, client_contact, coupon_code, paid_at, completed_at, cancelled_at, created_at, updated_at
		FROM tickets
		WHERE id = ?
	`
	var ticket model.Ticket
	var paidAt, completedAt, cancelledAt, caeDueDate sql.NullTime
	var invType, invNum, cae, tracking, seller, clientName, clientDNI, contact, coupon sql.NullString

	err := r.DB.QueryRowContext(ctx, query, id).Scan(
		&ticket.ID,
		&ticket.UserID,
		&ticket.TicketNumber,
		&ticket.Status,
		&ticket.PaymentMethod,
		&ticket.Subtotal,
		&ticket.TaxRate,
		&ticket.TaxAmount,
		&ticket.Total,
		&ticket.Notes,
		&invType,
		&invNum,
		&cae,
		&caeDueDate,
		&tracking,
		&seller,
		&clientName,
		&clientDNI, // <-- NUEVO
		&contact,
		&coupon,
		&paidAt,
		&completedAt,
		&cancelledAt,
		&ticket.CreatedAt,
		&ticket.UpdatedAt,
	)

	if err == sql.ErrNoRows {
		return nil, errorcode.ErrNotFound
	}
	if err != nil {
		fmt.Println("❌ ERROR EN GetByID:", err)
		return nil, err
	}

	if paidAt.Valid { ticket.PaidAt = &paidAt.Time }
	if completedAt.Valid { ticket.CompletedAt = &completedAt.Time }
	if cancelledAt.Valid { ticket.CancelledAt = &cancelledAt.Time }
	if caeDueDate.Valid { ticket.CAEDueDate = &caeDueDate.Time }
	if invType.Valid { ticket.InvoiceType = &invType.String }
	if invNum.Valid { ticket.InvoiceNumber = &invNum.String }
	if cae.Valid { ticket.CAE = &cae.String }
	if tracking.Valid { ticket.TrackingNumber = &tracking.String }

	if seller.Valid { ticket.SellerName = seller.String }
	if clientName.Valid { ticket.ClientName = clientName.String }
	if clientDNI.Valid { ticket.ClientDNI = clientDNI.String } // <-- NUEVO
	if contact.Valid { ticket.ClientContact = contact.String }
	if coupon.Valid { ticket.CouponCode = coupon.String }

	return &ticket, nil
}

func (r *TicketRepo) GetByTicketNumber(ctx context.Context, ticketNumber string) (*model.Ticket, error) {
	// IMPORTANTE: Le agregamos client_dni a la lectura
	query := `
		SELECT id, user_id, ticket_number, status, payment_method, subtotal, tax_rate, tax_amount, total, notes, invoice_type, invoice_number, cae, cae_due_date, tracking_number, seller_name, client_name, client_dni, client_contact, coupon_code, paid_at, completed_at, cancelled_at, created_at, updated_at
		FROM tickets
		WHERE ticket_number = ?
	`
	var ticket model.Ticket
	var paidAt, completedAt, cancelledAt, caeDueDate sql.NullTime
	var invType, invNum, cae, tracking, seller, clientName, clientDNI, contact, coupon sql.NullString

	err := r.DB.QueryRowContext(ctx, query, ticketNumber).Scan(
		&ticket.ID,
		&ticket.UserID,
		&ticket.TicketNumber,
		&ticket.Status,
		&ticket.PaymentMethod,
		&ticket.Subtotal,
		&ticket.TaxRate,
		&ticket.TaxAmount,
		&ticket.Total,
		&ticket.Notes,
		&invType,
		&invNum,
		&cae,
		&caeDueDate,
		&tracking,
		&seller,
		&clientName,
		&clientDNI, // <-- NUEVO
		&contact,
		&coupon,
		&paidAt,
		&completedAt,
		&cancelledAt,
		&ticket.CreatedAt,
		&ticket.UpdatedAt,
	)
	if err == sql.ErrNoRows {
		return nil, errorcode.ErrNotFound
	}
	if err != nil {
		fmt.Println("❌ ERROR EN GetByTicketNumber:", err)
		return nil, err
	}

	if paidAt.Valid { ticket.PaidAt = &paidAt.Time }
	if completedAt.Valid { ticket.CompletedAt = &completedAt.Time }
	if cancelledAt.Valid { ticket.CancelledAt = &cancelledAt.Time }
	if caeDueDate.Valid { ticket.CAEDueDate = &caeDueDate.Time }
	if invType.Valid { ticket.InvoiceType = &invType.String }
	if invNum.Valid { ticket.InvoiceNumber = &invNum.String }
	if cae.Valid { ticket.CAE = &cae.String }
	if tracking.Valid { ticket.TrackingNumber = &tracking.String }

	if seller.Valid { ticket.SellerName = seller.String }
	if clientName.Valid { ticket.ClientName = clientName.String }
	if clientDNI.Valid { ticket.ClientDNI = clientDNI.String } // <-- NUEVO
	if contact.Valid { ticket.ClientContact = contact.String }
	if coupon.Valid { ticket.CouponCode = coupon.String }

	return &ticket, nil
}

func (r *TicketRepo) ListByUserID(ctx context.Context, userID int64, filter repo.TicketFilter) ([]model.Ticket, error) {
	query := `
		SELECT id, user_id, ticket_number, status, payment_method, subtotal, tax_rate, tax_amount, total, notes, invoice_type, invoice_number, cae, cae_due_date, tracking_number, seller_name, client_name, client_dni, client_contact, coupon_code, paid_at, completed_at, cancelled_at, created_at, updated_at
		FROM tickets
		WHERE user_id = ?
	`
	args := []interface{}{userID}
	query, args = r.applyFilters(query, args, filter)

	rows, err := r.DB.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	return r.scanTickets(rows)
}

func (r *TicketRepo) List(ctx context.Context, filter repo.TicketFilter) ([]model.Ticket, error) {
	query := `
		SELECT id, user_id, ticket_number, status, payment_method, subtotal, tax_rate, tax_amount, total, notes, invoice_type, invoice_number, cae, cae_due_date, tracking_number, seller_name, client_name, client_dni, client_contact, coupon_code, paid_at, completed_at, cancelled_at, created_at, updated_at
		FROM tickets
		WHERE 1=1
	`
	args := []interface{}{}
	query, args = r.applyFilters(query, args, filter)

	rows, err := r.DB.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	return r.scanTickets(rows)
}

func (r *TicketRepo) Update(ctx context.Context, ticket *model.Ticket) error {
	query := `
		UPDATE tickets
		SET status = ?, completed_at = ?, cancelled_at = ?, tracking_number = ?, updated_at = ?
		WHERE id = ?
	`
	_, err := r.DB.ExecContext(ctx, query,
		ticket.Status,
		ticket.CompletedAt,
		ticket.CancelledAt,
		ticket.TrackingNumber,
		ticket.UpdatedAt,
		ticket.ID,
	)
	return err
}

func (r *TicketRepo) MarkAsPaid(ctx context.Context, ticketID int64) error {
	query := `
		UPDATE tickets
		SET status = 'paid', paid_at = NOW(), updated_at = NOW()
		WHERE id = ? AND status = 'pending'
	`
	res, err := r.DB.ExecContext(ctx, query, ticketID)
	if err != nil {
		return err
	}
	aff, _ := res.RowsAffected()
	if aff == 0 {
		return nil
	}
	return nil
}

func (r *TicketRepo) UpdateAFIPFields(ctx context.Context, ticketID int64, invType, invNum, cae string, caeDue time.Time) error {
	query := `
		UPDATE tickets
		SET invoice_type = ?, invoice_number = ?, cae = ?, cae_due_date = ?, updated_at = NOW()
		WHERE id = ?
	`
	caeDueNull := sql.NullTime{Time: caeDue, Valid: !caeDue.IsZero()}
	_, err := r.DB.ExecContext(ctx, query, invType, invNum, cae, caeDueNull, ticketID)
	return err
}

func (r *TicketRepo) Delete(ctx context.Context, id int64) error {
	query := `DELETE FROM tickets WHERE id = ?`
	res, err := r.DB.ExecContext(ctx, query, id)
	if err != nil {
		return err
	}
	aff, _ := res.RowsAffected()
	if aff == 0 {
		return errorcode.ErrNotFound
	}
	return nil
}

func (r *TicketRepo) applyFilters(query string, args []interface{}, filter repo.TicketFilter) (string, []interface{}) {
	conditions := []string{}

	if filter.Status != "" {
		conditions = append(conditions, "status = ?")
		args = append(args, filter.Status)
	}

	if filter.UserID > 0 {
		conditions = append(conditions, "user_id = ?")
		args = append(args, filter.UserID)
	}

	if filter.DateFrom != "" {
		conditions = append(conditions, "DATE(created_at) >= ?")
		args = append(args, filter.DateFrom)
	}

	if filter.DateTo != "" {
		conditions = append(conditions, "DATE(created_at) <= ?")
		args = append(args, filter.DateTo)
	}
	if filter.OnlyWithCAE {
		conditions = append(conditions, "caE IS NOT NULL")
	}

	if len(conditions) > 0 {
		query += " AND " + strings.Join(conditions, " AND ")
	}

	query += " ORDER BY created_at DESC"

	if filter.Limit > 0 {
		query += " LIMIT ?"
		args = append(args, filter.Limit)
	}

	if filter.Offset > 0 {
		query += " OFFSET ?"
		args = append(args, filter.Offset)
	}

	return query, args
}

func (r *TicketRepo) scanTickets(rows *sql.Rows) ([]model.Ticket, error) {
	var tickets []model.Ticket
	for rows.Next() {
		var ticket model.Ticket
		var paidAt, completedAt, cancelledAt, caeDueDate sql.NullTime
		var invType, invNum, cae, tracking, seller, clientName, clientDNI, contact, coupon sql.NullString
		
		err := rows.Scan(
			&ticket.ID,
			&ticket.UserID,
			&ticket.TicketNumber,
			&ticket.Status,
			&ticket.PaymentMethod,
			&ticket.Subtotal,
			&ticket.TaxRate,
			&ticket.TaxAmount,
			&ticket.Total,
			&ticket.Notes,
			&invType,
			&invNum,
			&cae,
			&caeDueDate,
			&tracking,
			&seller,
			&clientName,
			&clientDNI, // <-- NUEVO (Para Listados)
			&contact,
			&coupon,
			&paidAt,
			&completedAt,
			&cancelledAt,
			&ticket.CreatedAt,
			&ticket.UpdatedAt,
		)
		if err != nil {
			fmt.Println("❌ ERROR EN SCAN TICKETS:", err)
			return nil, err
		}

		if paidAt.Valid { ticket.PaidAt = &paidAt.Time }
		if completedAt.Valid { ticket.CompletedAt = &completedAt.Time }
		if cancelledAt.Valid { ticket.CancelledAt = &cancelledAt.Time }
		if caeDueDate.Valid { ticket.CAEDueDate = &caeDueDate.Time }
		if invType.Valid { ticket.InvoiceType = &invType.String }
		if invNum.Valid { ticket.InvoiceNumber = &invNum.String }
		if cae.Valid { ticket.CAE = &cae.String }
		if tracking.Valid { ticket.TrackingNumber = &tracking.String }

		if seller.Valid { ticket.SellerName = seller.String }
		if clientName.Valid { ticket.ClientName = clientName.String } 
		if clientDNI.Valid { ticket.ClientDNI = clientDNI.String } // <-- NUEVO
		if contact.Valid { ticket.ClientContact = contact.String }
		if coupon.Valid { ticket.CouponCode = coupon.String }

		tickets = append(tickets, ticket)
	}
	return tickets, rows.Err()
}