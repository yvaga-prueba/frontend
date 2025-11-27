package entity

import (
	"context"
	"database/sql"

	"core/domain/model"
	"core/domain/repo"
)

type productImageRepository struct {
	db *sql.DB
}

func NewProductImageRepository(db *sql.DB) repo.ProductImageRepository {
	return &productImageRepository{db: db}
}

var _ repo.ProductImageRepository = (*productImageRepository)(nil)

func (r *productImageRepository) Create(ctx context.Context, image *model.ProductImage) error {
	query := `
		INSERT INTO product_images (product_id, url, is_primary, position, created_at)
		VALUES (?, ?, ?, ?, NOW())
	`
	result, err := r.db.ExecContext(ctx, query, image.ProductID, image.URL, image.IsPrimary, image.Position)
	if err != nil {
		return err
	}
	id, err := result.LastInsertId()
	if err != nil {
		return err
	}
	image.ID = id
	return nil
}

func (r *productImageRepository) FindByProductID(ctx context.Context, productID int64) ([]model.ProductImage, error) {
	query := `
		SELECT id, product_id, url, is_primary, position, created_at
		FROM product_images
		WHERE product_id = ?
		ORDER BY position ASC, id ASC
	`
	rows, err := r.db.QueryContext(ctx, query, productID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var images []model.ProductImage
	for rows.Next() {
		var img model.ProductImage
		if err := rows.Scan(&img.ID, &img.ProductID, &img.URL, &img.IsPrimary, &img.Position, &img.CreatedAt); err != nil {
			return nil, err
		}
		images = append(images, img)
	}
	return images, rows.Err()
}

func (r *productImageRepository) Delete(ctx context.Context, id int64) error {
	query := `DELETE FROM product_images WHERE id = ?`
	_, err := r.db.ExecContext(ctx, query, id)
	return err
}
