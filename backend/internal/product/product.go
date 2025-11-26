package product

import (
	"context"
)

type ProductService interface {
	Create(ctx context.Context, p *Product) (*Product, error)
	GetByID(ctx context.Context, id int64) (*Product, error)
	Update(ctx context.Context, p *Product) (*Product, error)
	Delete(ctx context.Context, id int64) error
	List(ctx context.Context, cursor string, num int64) ([]Product, string, error)
}
