package repo

import (
	"context"
	"core/domain/model"
)

type SellerRepository interface {
	GetAll(ctx context.Context) ([]model.Seller, error)
	GetByCode(ctx context.Context, code string) (*model.Seller, error)
	Create(ctx context.Context, seller *model.Seller) error
	Update(ctx context.Context, seller *model.Seller) error
}