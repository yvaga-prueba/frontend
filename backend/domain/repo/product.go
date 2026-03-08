package repo

import (
	"context"
	"core/domain/model"
)

type ProductRepository interface {
	GetByID(ctx context.Context, id int64) (*model.Product, error)
	List(ctx context.Context, filter model.ProductFilter) ([]model.Product, error)
	UpdateStock(ctx context.Context, id int64, delta int64) error

	Create(ctx context.Context, p *model.Product) error
	Read(ctx context.Context) ([]model.Product, error)
	Update(ctx context.Context, p *model.Product) error
	Delete(ctx context.Context, id int64) error
	GetVariantsByTitle(ctx context.Context, title string) ([]model.Product, error)
}
