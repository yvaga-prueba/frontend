package mysql

import (
	"context"
	"database/sql"
	"errors"
	"fmt"

	"core/internal/domain/entity"
	domainerrors "core/internal/domain/errors"
	"core/internal/domain/repository"

	mysqlerr "github.com/go-sql-driver/mysql"
)

type ProductRepo struct {
	DB *sql.DB
}

func NewProductRepository(db *sql.DB) *ProductRepo { return &ProductRepo{DB: db} }

var _ repository.ProductRepository = (*ProductRepo)(nil)

func (r *ProductRepo) Create(ctx context.Context, p *entity.Product) error {
	res, err := r.DB.ExecContext(ctx, `
		INSERT INTO products (bar_code, title, description, stock, size, category, unit_price)
		VALUES (?,?,?,?,?,?,?)`,
		p.BarCode, p.Title, p.Description, p.Stock, p.Size, p.Category, p.UnitPrice,
	)
	if err != nil {
		var me *mysqlerr.MySQLError
		if errors.As(err, &me) && me.Number == 1062 {
			return domainerrors.ErrConflict
		}
		return err
	}
	id, _ := res.LastInsertId()
	p.ID = id
	return nil
}

func (r *ProductRepo) Read(ctx context.Context) ([]entity.Product, error) {
	q := `SELECT id, bar_code, title, description, stock, size, category, unit_price, updated_at, created_at 
		FROM products`

	rows, err := r.DB.QueryContext(ctx, q)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []entity.Product
	for rows.Next() {
		var p entity.Product
		if err := rows.Scan(&p.ID, &p.BarCode, &p.Title, &p.Description, &p.Stock, &p.Size, &p.Category, &p.UnitPrice, &p.UpdatedAt, &p.CreatedAt); err != nil {
			return nil, err
		}
		out = append(out, p)
	}
	return out, rows.Err()
}

func (r *ProductRepo) Update(ctx context.Context, product *entity.Product) error {
	query := `
		UPDATE products
		SET bar_code = ?, title = ?, description = ?, stock = ?, size = ?, category = ?, unit_price = ?, updated_at = NOW()
		WHERE id = ?
	`
	result, err := r.DB.ExecContext(ctx, query,
		product.BarCode,
		product.Title,
		product.Description,
		product.Stock,
		product.Size,
		product.Category,
		product.UnitPrice,
		product.ID,
	)
	if err != nil {
		return fmt.Errorf("failed to update product: %w", err)
	}

	rows, err := result.RowsAffected()
	if err != nil {
		return err
	}

	if rows == 0 {
		return fmt.Errorf("product not found")
	}

	return nil
}

func (r *ProductRepo) Delete(ctx context.Context, id int64) error {
	query := `DELETE FROM products WHERE id = ?`

	result, err := r.DB.ExecContext(ctx, query, id)
	if err != nil {
		return fmt.Errorf("failed to delete product: %w", err)
	}

	rows, err := result.RowsAffected()
	if err != nil {
		return err
	}

	if rows == 0 {
		return fmt.Errorf("product not found")
	}

	return nil
}

func (r *ProductRepo) GetByID(ctx context.Context, id int64) (entity.Product, error) {
	var p entity.Product
	err := r.DB.QueryRowContext(ctx, `
		SELECT id, bar_code, title, description, stock, size, category, unit_price, updated_at, created_at
		FROM products WHERE id = ?`, id).
		Scan(&p.ID, &p.BarCode, &p.Title, &p.Description, &p.Stock, &p.Size, &p.Category, &p.UnitPrice, &p.UpdatedAt, &p.CreatedAt)
	if errors.Is(err, sql.ErrNoRows) {
		return entity.Product{}, domainerrors.ErrNotFound
	}
	return p, err
}

func (r *ProductRepo) List(ctx context.Context, f entity.ProductFilter) ([]entity.Product, error) {
	q := `
		SELECT id, bar_code, title, description, stock, size, category, unit_price, updated_at, created_at
		FROM products`
	args := []any{}
	if f.Category != "" {
		q += " AND category = ?"
		args = append(args, f.Category)
	}
	if f.Size != "" {
		q += " AND size = ?"
		args = append(args, f.Size)
	}
	if f.Query != "" {
		q += " AND (title LIKE ? OR description LIKE ?)"
		like := "%" + f.Query + "%"
		args = append(args, like, like)
	}
	q += " ORDER BY created_at DESC"
	limit := 20
	if f.Limit > 0 && f.Limit <= 100 {
		limit = f.Limit
	}
	offset := f.Offset
	q += " LIMIT ? OFFSET ?"
	args = append(args, limit, offset)

	rows, err := r.DB.QueryContext(ctx, q, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []entity.Product
	for rows.Next() {
		var p entity.Product
		if err := rows.Scan(&p.ID, &p.BarCode, &p.Title, &p.Description, &p.Stock, &p.Size, &p.Category, &p.UnitPrice, &p.UpdatedAt, &p.CreatedAt); err != nil {
			return nil, err
		}
		out = append(out, p)
	}
	return out, rows.Err()
}

func (r *ProductRepo) UpdateStock(ctx context.Context, id int64, delta int64) error {
	res, err := r.DB.ExecContext(ctx, `UPDATE products SET stock = stock + ? WHERE id = ?`, delta, id)
	if err != nil {
		return err
	}
	aff, _ := res.RowsAffected()
	if aff == 0 {
		return domainerrors.ErrNotFound
	}
	return nil
}
