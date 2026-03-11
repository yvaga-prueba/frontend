package service

import (
	"context"
	"core/domain/model"
	"core/domain/repo"
)

type SellerService interface {
	GetAll(ctx context.Context) ([]model.Seller, error)
	Create(ctx context.Context, seller *model.Seller) error
	Update(ctx context.Context, seller *model.Seller) error
}

type sellerServiceImpl struct {
	sellerRepo repo.SellerRepository
}

func NewSellerService(r repo.SellerRepository) SellerService {
	return &sellerServiceImpl{sellerRepo: r}
}

func (s *sellerServiceImpl) GetAll(ctx context.Context) ([]model.Seller, error) {
	return s.sellerRepo.GetAll(ctx)
}

func (s *sellerServiceImpl) Create(ctx context.Context, seller *model.Seller) error {
	seller.IsActive = true // Al crearlo, por defecto está activo
	return s.sellerRepo.Create(ctx, seller)
}

func (s *sellerServiceImpl) Update(ctx context.Context, seller *model.Seller) error {
	return s.sellerRepo.Update(ctx, seller)
}