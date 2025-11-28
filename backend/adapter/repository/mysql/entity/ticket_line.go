package entity

import (
	"context"
	"database/sql"

	"core/domain/model"
	"core/domain/repo"
)

type TicketLineRepo struct {
	DB *sql.DB
}

func NewTicketLineRepository(db *sql.DB) repo.TicketLineRepository {
	return &TicketLineRepo{DB: db}
}

var _ repo.TicketLineRepository = (*TicketLineRepo)(nil)

func (r *TicketLineRepo) Create(ctx context.Context, line *model.TicketLine) error {
	query := `
		INSERT INTO ticket_lines (ticket_id, product_id, product_title, product_size, quantity, unit_price, subtotal, created_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?)
	`
	res, err := r.DB.ExecContext(ctx, query,
		line.TicketID,
		line.ProductID,
		line.ProductTitle,
		line.ProductSize,
		line.Quantity,
		line.UnitPrice,
		line.Subtotal,
		line.CreatedAt,
	)
	if err != nil {
		return err
	}
	id, _ := res.LastInsertId()
	line.ID = id
	return nil
}

func (r *TicketLineRepo) CreateBatch(ctx context.Context, lines []model.TicketLine) error {
	if len(lines) == 0 {
		return nil
	}

	tx, err := r.DB.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	stmt, err := tx.PrepareContext(ctx, `
		INSERT INTO ticket_lines (ticket_id, product_id, product_title, product_size, quantity, unit_price, subtotal, created_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?)
	`)
	if err != nil {
		return err
	}
	defer stmt.Close()

	for i := range lines {
		res, err := stmt.ExecContext(ctx,
			lines[i].TicketID,
			lines[i].ProductID,
			lines[i].ProductTitle,
			lines[i].ProductSize,
			lines[i].Quantity,
			lines[i].UnitPrice,
			lines[i].Subtotal,
			lines[i].CreatedAt,
		)
		if err != nil {
			return err
		}
		id, _ := res.LastInsertId()
		lines[i].ID = id
	}

	return tx.Commit()
}

func (r *TicketLineRepo) GetByTicketID(ctx context.Context, ticketID int64) ([]model.TicketLine, error) {
	query := `
		SELECT id, ticket_id, product_id, product_title, product_size, quantity, unit_price, subtotal, created_at
		FROM ticket_lines
		WHERE ticket_id = ?
		ORDER BY id ASC
	`
	rows, err := r.DB.QueryContext(ctx, query, ticketID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var lines []model.TicketLine
	for rows.Next() {
		var line model.TicketLine
		err := rows.Scan(
			&line.ID,
			&line.TicketID,
			&line.ProductID,
			&line.ProductTitle,
			&line.ProductSize,
			&line.Quantity,
			&line.UnitPrice,
			&line.Subtotal,
			&line.CreatedAt,
		)
		if err != nil {
			return nil, err
		}
		lines = append(lines, line)
	}
	return lines, rows.Err()
}

func (r *TicketLineRepo) Update(ctx context.Context, line *model.TicketLine) error {
	query := `
		UPDATE ticket_lines
		SET quantity = ?, unit_price = ?, subtotal = ?
		WHERE id = ?
	`
	_, err := r.DB.ExecContext(ctx, query,
		line.Quantity,
		line.UnitPrice,
		line.Subtotal,
		line.ID,
	)
	return err
}

func (r *TicketLineRepo) Delete(ctx context.Context, id int64) error {
	query := `DELETE FROM ticket_lines WHERE id = ?`
	_, err := r.DB.ExecContext(ctx, query, id)
	return err
}

func (r *TicketLineRepo) DeleteByTicketID(ctx context.Context, ticketID int64) error {
	query := `DELETE FROM ticket_lines WHERE ticket_id = ?`
	_, err := r.DB.ExecContext(ctx, query, ticketID)
	return err
}
