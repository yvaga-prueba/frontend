package product

import (
	"context"
)

type ProductRepository interface {
	GetByID(ctx context.Context, id int64) (Product, error)
	List(ctx context.Context, filter ProductFilter) ([]Product, error)
	UpdateStock(ctx context.Context, id int64, delta int64) error

	Create(ctx context.Context, p *Product) error
	Read(ctx context.Context) ([]Product, error)
	Update(ctx context.Context, p *Product) error
	Delete(ctx context.Context, id int64) error
}
