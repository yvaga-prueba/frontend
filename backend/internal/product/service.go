package product

import (
	"context"
)

type productServiceImpl struct {
	repo ProductRepository
}

func NewProductService(repo ProductRepository) ProductService {
	return &productServiceImpl{repo: repo}
}

func (s *productServiceImpl) Create(ctx context.Context, p *Product) (*Product, error) {
	if err := s.repo.Create(ctx, p); err != nil {
		return nil, err
	}
	return p, nil
}

func (s *productServiceImpl) GetByID(ctx context.Context, id int64) (*Product, error) {
	product, err := s.repo.GetByID(ctx, id)
	if err != nil {
		return nil, err
	}
	return &product, nil
}

func (s *productServiceImpl) Update(ctx context.Context, p *Product) (*Product, error) {
	if err := s.repo.Update(ctx, p); err != nil {
		return nil, err
	}
	return p, nil
}

func (s *productServiceImpl) Delete(ctx context.Context, id int64) error {
	return s.repo.Delete(ctx, id)
}

func (s *productServiceImpl) List(ctx context.Context, cursor string, num int64) ([]Product, string, error) {
	// Convertir a ProductFilter
	filter := ProductFilter{
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
