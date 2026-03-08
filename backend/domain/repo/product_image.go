package repo

import (
	"context"
	"core/domain/model"
)

type ProductImageRepository interface {
	Create(ctx context.Context, image *model.ProductImage) error
	FindByProductID(ctx context.Context, productID int64) ([]model.ProductImage, error)
	FindByID(ctx context.Context, id int64) (*model.ProductImage, error)
	Delete(ctx context.Context, id int64) error
	DeleteByDriveFileID(ctx context.Context, driveFileID string) error
	UpdateOrder(ctx context.Context, productID int64, imageIDs []int64) error
}
