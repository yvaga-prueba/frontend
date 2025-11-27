package service

import (
	"context"
	"core/domain/model"
	"core/domain/repo"
)

type productServiceImpl struct {
	repo repo.ProductRepository
}

func NewProductService(repo repo.ProductRepository) ProductService {
	return &productServiceImpl{repo: repo}
}

func (s *productServiceImpl) Create(ctx context.Context, p *model.Product) (*model.Product, error) {
	if err := s.repo.Create(ctx, p); err != nil {
		return nil, err
	}
	return p, nil
}

func (s *productServiceImpl) GetByID(ctx context.Context, id int64) (*model.Product, error) {
	product, err := s.repo.GetByID(ctx, id)
	if err != nil {
		return nil, err
	}
	return product, nil
}

func (s *productServiceImpl) Update(ctx context.Context, p *model.Product) (*model.Product, error) {
	if err := s.repo.Update(ctx, p); err != nil {
		return nil, err
	}
	return p, nil
}

func (s *productServiceImpl) Delete(ctx context.Context, id int64) error {
	return s.repo.Delete(ctx, id)
}

func (s *productServiceImpl) List(ctx context.Context, cursor string, num int64) ([]model.Product, string, error) {
	// Convertir a model.ProductFilter
	filter := model.ProductFilter{
		Limit:  int(num),
		Offset: 0,
	}

	products, err := s.repo.List(ctx, filter)
	if err != nil {
		return nil, "", err
	}

	// Por ahora no implementamos cursor real, devolvemos vacío
	return products, "", nil
}

type ProductService interface {
	Create(ctx context.Context, p *model.Product) (*model.Product, error)
	GetByID(ctx context.Context, id int64) (*model.Product, error)
	Update(ctx context.Context, p *model.Product) (*model.Product, error)
	Delete(ctx context.Context, id int64) error
	List(ctx context.Context, cursor string, num int64) ([]model.Product, string, error)
}
