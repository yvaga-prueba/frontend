package user

import (
	"context"
)

type UserRepository interface {
	Store(ctx context.Context, user *User) error
	GetByID(ctx context.Context, id int64) (User, error)
	GetByEmail(ctx context.Context, email string) (User, error)
	GetByGoogleID(ctx context.Context, googleID string) (User, error)
	Update(ctx context.Context, user *User) error
	UpdatePassword(ctx context.Context, id int64, hashedPassword string) error
}
