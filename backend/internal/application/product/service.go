package product

import (
	"context"
	"core/internal/domain/entity"
	"core/internal/domain/repository"
	"fmt"
)

type Service struct {
	repo repository.ProductRepository
}

func New(repo repository.ProductRepository) *Service {
	return &Service{repo: repo}
}

// GetByID obtiene un producto por ID
func (s *Service) GetByID(ctx context.Context, id int64) (entity.Product, error) {
	return s.repo.GetByID(ctx, id)
}

// List obtiene productos con filtros
func (s *Service) List(ctx context.Context, f entity.ProductFilter) ([]entity.Product, error) {
	return s.repo.List(ctx, f)
}

// Read obtiene todos los productos activos
func (s *Service) Read(ctx context.Context) ([]entity.Product, error) {
	return s.repo.Read(ctx)
}

// Create crea un nuevo producto
func (s *Service) Create(ctx context.Context, p *entity.Product) (*entity.Product, error) {
	if err := s.repo.Create(ctx, p); err != nil {
		return nil, fmt.Errorf("failed to create product: %w", err)
	}
	return p, nil
}

// Update actualiza un producto existente
func (s *Service) Update(ctx context.Context, p *entity.Product) error {
	// Verificar que exista
	_, err := s.repo.GetByID(ctx, p.ID)
	if err != nil {
		return fmt.Errorf("product not found: %w", err)
	}

	return s.repo.Update(ctx, p)
}

// Delete elimina un producto (soft delete o hard delete según tu repo)
func (s *Service) Delete(ctx context.Context, id int64) error {
	// Verificar que exista
	_, err := s.repo.GetByID(ctx, id)
	if err != nil {
		return fmt.Errorf("product not found: %w", err)
	}

	return s.repo.Delete(ctx, id)
}
