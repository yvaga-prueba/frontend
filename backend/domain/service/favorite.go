package service

import (
	"context"
	"core/domain/model"
	"core/domain/repo"
)

type FavoriteService interface {
	ToggleFavorite(ctx context.Context, userID, productID int64) (bool, error)
	GetUserFavorites(ctx context.Context, userID int64) ([]model.Product, error)
}

type favoriteService struct {
	repo repo.FavoriteRepository
}

func NewFavoriteService(r repo.FavoriteRepository) FavoriteService {
	return &favoriteService{repo: r}
}

// ToggleFavorite: Si ya tiene me gusta se lo saca, si no lo tiene se lo agrega
func (s *favoriteService) ToggleFavorite(ctx context.Context, userID, productID int64) (bool, error) {
	isFav, err := s.repo.IsFavorite(ctx, userID, productID)
	if err != nil { return false, err }

	if isFav {
		err = s.repo.Remove(ctx, userID, productID)
		return false, err 
	} else {
		err = s.repo.Add(ctx, userID, productID)
		return true, err 
	}
}

func (s *favoriteService) GetUserFavorites(ctx context.Context, userID int64) ([]model.Product, error) {
	return s.repo.GetUserFavorites(ctx, userID)
}