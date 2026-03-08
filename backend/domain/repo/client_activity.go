package repo

import (
	"context"
	"core/domain/model"
)

type ClientActivityRepository interface {
	Create(ctx context.Context, activity *model.ClientActivity) error
	ListRecent(ctx context.Context, limit int) ([]model.ClientActivity, error)
}
