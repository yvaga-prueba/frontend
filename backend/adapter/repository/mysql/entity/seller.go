package entity

import (
	"context"
	"database/sql"
	"core/domain/model"
)

type SellerRepo struct {
	DB *sql.DB
}

func NewSellerRepo(db *sql.DB) *SellerRepo {
	return &SellerRepo{DB: db}
}

// lista para el panel
func (r *SellerRepo) GetAll(ctx context.Context) ([]model.Seller, error) {
	query := `SELECT id, first_name, last_name, email, phone, coupon_code, discount_percentage, is_active FROM sellers`
	
	rows, err := r.DB.QueryContext(ctx, query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var sellers []model.Seller
	for rows.Next() {
		var s model.Seller
		if err := rows.Scan(&s.ID, &s.FirstName, &s.LastName, &s.Email, &s.Phone, &s.CouponCode, &s.DiscountPercentage, &s.IsActive); err != nil {
			return nil, err
		}
		sellers = append(sellers, s)
	}
	return sellers, nil
}

// Gfuncion que verifica si el cupon existe
func (r *SellerRepo) GetByCode(ctx context.Context, code string) (*model.Seller, error) {
	query := `SELECT id, first_name, last_name, email, phone, coupon_code, discount_percentage, is_active FROM sellers WHERE coupon_code = ? AND is_active = true`
	
	var s model.Seller
	err := r.DB.QueryRowContext(ctx, query, code).Scan(&s.ID, &s.FirstName, &s.LastName, &s.Email, &s.Phone, &s.CouponCode, &s.DiscountPercentage, &s.IsActive)
	if err != nil {
		return nil, err // Tira error si no existe o si el vendedor está inactivo
	}
	return &s, nil
}

// inserta un vendedor 
func (r *SellerRepo) Create(ctx context.Context, seller *model.Seller) error {
	query := `INSERT INTO sellers (first_name, last_name, email, phone, coupon_code, discount_percentage, is_active) VALUES (?, ?, ?, ?, ?, ?, ?)`
	
	res, err := r.DB.ExecContext(ctx, query, seller.FirstName, seller.LastName, seller.Email, seller.Phone, seller.CouponCode, seller.DiscountPercentage, seller.IsActive)
	if err != nil {
		return err
	}
	
	id, _ := res.LastInsertId()
	seller.ID = id
	return nil
}

// guardamos los cambios si editamos o dejamos inactivo
func (r *SellerRepo) Update(ctx context.Context, seller *model.Seller) error {
	query := `UPDATE sellers SET first_name = ?, last_name = ?, email = ?, phone = ?, coupon_code = ?, discount_percentage = ?, is_active = ? WHERE id = ?`
	
	_, err := r.DB.ExecContext(ctx, query, seller.FirstName, seller.LastName, seller.Email, seller.Phone, seller.CouponCode, seller.DiscountPercentage, seller.IsActive, seller.ID)
	return err
}