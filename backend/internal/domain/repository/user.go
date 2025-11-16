package repository

import (
	"context"
	"core/internal/domain/entity"
)

type UserRepository interface {
	Store(ctx context.Context, user *entity.User) error
	GetByID(ctx context.Context, id int64) (entity.User, error)
	GetByEmail(ctx context.Context, email string) (entity.User, error)
	GetByGoogleID(ctx context.Context, googleID string) (entity.User, error)
	Update(ctx context.Context, user *entity.User) error
	UpdatePassword(ctx context.Context, id int64, hashedPassword string) error
}
