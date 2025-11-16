package repository

import (
	"context"
	"core/internal/domain/entity"
)

type ProductRepository interface {
	GetByID(ctx context.Context, id int64) (entity.Product, error)
	List(ctx context.Context, filter entity.ProductFilter) ([]entity.Product, error)
	UpdateStock(ctx context.Context, id int64, delta int64) error

	Create(ctx context.Context, p *entity.Product) error
	Read(ctx context.Context) ([]entity.Product, error)
	Update(ctx context.Context, p *entity.Product) error
	Delete(ctx context.Context, id int64) error
}
