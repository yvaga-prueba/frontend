package repo

import (
	"context"
	"core/domain/model"
)

type FavoriteRepository interface {
	Add(ctx context.Context, userID, productID int64) error
	Remove(ctx context.Context, userID, productID int64) error
	GetUserFavorites(ctx context.Context, userID int64) ([]model.Product, error)
	IsFavorite(ctx context.Context, userID, productID int64) (bool, error)
}