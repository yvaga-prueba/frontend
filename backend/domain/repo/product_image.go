package repo

import (
	"context"
	"core/domain/model"
)

type ProductImageRepository interface {
	Create(ctx context.Context, image *model.ProductImage) error
	FindByProductID(ctx context.Context, productID int64) ([]model.ProductImage, error)
	Delete(ctx context.Context, id int64) error
}
