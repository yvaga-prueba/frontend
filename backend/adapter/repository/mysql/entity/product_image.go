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
		INSERT INTO product_images (product_id, url, drive_file_id, is_primary, position, created_at)
		VALUES (?, ?, ?, ?, ?, NOW())
	`
	result, err := r.db.ExecContext(ctx, query, image.ProductID, image.URL, image.DriveFileID, image.IsPrimary, image.Position)
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
		SELECT id, product_id, url, drive_file_id, is_primary, position, created_at
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
		if err := rows.Scan(&img.ID, &img.ProductID, &img.URL, &img.DriveFileID, &img.IsPrimary, &img.Position, &img.CreatedAt); err != nil {
			return nil, err
		}
		images = append(images, img)
	}
	return images, rows.Err()
}

func (r *productImageRepository) FindByID(ctx context.Context, id int64) (*model.ProductImage, error) {
	query := `
		SELECT id, product_id, url, drive_file_id, is_primary, position, created_at
		FROM product_images
		WHERE id = ?
	`
	var img model.ProductImage
	err := r.db.QueryRowContext(ctx, query, id).Scan(
		&img.ID, &img.ProductID, &img.URL, &img.DriveFileID, &img.IsPrimary, &img.Position, &img.CreatedAt,
	)
	if err != nil {
		return nil, err
	}
	return &img, nil
}

func (r *productImageRepository) Delete(ctx context.Context, id int64) error {
	query := `DELETE FROM product_images WHERE id = ?`
	_, err := r.db.ExecContext(ctx, query, id)
	return err
}

func (r *productImageRepository) DeleteByDriveFileID(ctx context.Context, driveFileID string) error {
	query := `DELETE FROM product_images WHERE drive_file_id = ?`
	_, err := r.db.ExecContext(ctx, query, driveFileID)
	return err
}

func (r *productImageRepository) UpdateOrder(ctx context.Context, productID int64, imageIDs []int64) error {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}

	query := `UPDATE product_images SET position = ?, is_primary = ? WHERE id = ? AND product_id = ?`
	stmt, err := tx.PrepareContext(ctx, query)
	if err != nil {
		tx.Rollback()
		return err
	}
	defer stmt.Close()

	for i, id := range imageIDs {
		isPrimary := false
		if i == 0 {
			isPrimary = true
		}

		_, err = stmt.ExecContext(ctx, i, isPrimary, id, productID)
		if err != nil {
			tx.Rollback()
			return err
		}
	}

	if err := tx.Commit(); err != nil {
		return err
	}

	return nil
}
