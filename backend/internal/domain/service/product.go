package service

import (
	"context"
	"core/internal/domain/entity"
)

type ProductService interface {
	Create(ctx context.Context, p *entity.Product) (*entity.Product, error)
	GetByID(ctx context.Context, id int64) (*entity.Product, error)
	Update(ctx context.Context, p *entity.Product) (*entity.Product, error)
	Delete(ctx context.Context, id int64) error
	List(ctx context.Context, cursor string, num int64) ([]entity.Product, string, error)
}
