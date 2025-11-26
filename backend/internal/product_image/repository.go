package product_image

import (
	"context"
)

type ProductImageRepository interface {
	Create(ctx context.Context, image *ProductImage) error
	FindByProductID(ctx context.Context, productID int64) ([]ProductImage, error)
	Delete(ctx context.Context, id int64) error
}
