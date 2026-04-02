package entity

import (
	"context"
	"database/sql"
	"core/domain/model"
	"core/domain/repo"
)

type favoriteRepository struct {
	db *sql.DB
}

func NewFavoriteRepository(db *sql.DB) repo.FavoriteRepository {
	return &favoriteRepository{db: db}
}

func (r *favoriteRepository) Add(ctx context.Context, userID, productID int64) error {
	query := `INSERT IGNORE INTO user_favorites (user_id, product_id) VALUES (?, ?)`
	_, err := r.db.ExecContext(ctx, query, userID, productID)
	return err
}

func (r *favoriteRepository) Remove(ctx context.Context, userID, productID int64) error {
	query := `DELETE FROM user_favorites WHERE user_id = ? AND product_id = ?`
	_, err := r.db.ExecContext(ctx, query, userID, productID)
	return err
}

func (r *favoriteRepository) GetUserFavorites(ctx context.Context, userID int64) ([]model.Product, error) {
	query := `
		SELECT p.id, p.title, p.description, p.unit_price, p.stock, p.category, p.size, p.color, p.gender
		FROM products p
		INNER JOIN user_favorites uf ON p.id = uf.product_id
		WHERE uf.user_id = ?`
	
	rows, err := r.db.QueryContext(ctx, query, userID)
	if err != nil { return nil, err }
	defer rows.Close()

	var products []model.Product
	for rows.Next() {
		var p model.Product
		var desc, size, color, gender sql.NullString
		if err := rows.Scan(&p.ID, &p.Title, &desc, &p.UnitPrice, &p.Stock, &p.Category, &size, &color, &gender); err != nil {
			return nil, err
		}
		if desc.Valid { p.Description = desc.String }
		if size.Valid { p.Size = size.String }
		if color.Valid { p.Color = color.String }
		if gender.Valid { p.Gender = gender.String }
		products = append(products, p)
	}
	return products, nil
}

func (r *favoriteRepository) IsFavorite(ctx context.Context, userID, productID int64) (bool, error) {
	query := `SELECT 1 FROM user_favorites WHERE user_id = ? AND product_id = ?`
	var dummy int
	err := r.db.QueryRowContext(ctx, query, userID, productID).Scan(&dummy)
	if err == sql.ErrNoRows { return false, nil }
	if err != nil { return false, err }
	return true, nil
}