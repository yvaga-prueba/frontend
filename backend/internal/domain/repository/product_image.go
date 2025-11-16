package repository

import (
	"context"
	"core/internal/domain/entity"
)

type ProductImageRepository interface {
	Create(ctx context.Context, image *entity.ProductImage) error
	FindByProductID(ctx context.Context, productID int64) ([]entity.ProductImage, error)
	Delete(ctx context.Context, id int64) error
}
