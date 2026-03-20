package repo

import (
	"context"
	"core/domain/model"
	"time"
)

type DashboardRepository interface {
	GetStats(ctx context.Context, startDate time.Time, endDate time.Time) (*model.DashboardStats, error)
}