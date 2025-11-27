package repo

import (
	"context"
	"core/domain/model"
)

type UserRepository interface {
	Store(ctx context.Context, user *model.User) error
	GetByID(ctx context.Context, id int64) (model.User, error)
	GetByEmail(ctx context.Context, email string) (model.User, error)
	GetByGoogleID(ctx context.Context, googleID string) (model.User, error)
	GetByIOSID(ctx context.Context, iosID string) (model.User, error)
	Update(ctx context.Context, user *model.User) error
	UpdatePassword(ctx context.Context, userID int64, hashedPassword string) error
	Delete(ctx context.Context, id int64) error
}
