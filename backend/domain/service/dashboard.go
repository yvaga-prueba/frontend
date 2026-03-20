package service

import (
	"context"
	"time"

	"core/domain/model"
	"core/domain/repo"
)

type DashboardService interface {
	GetStats(ctx context.Context, startDate time.Time, endDate time.Time) (*model.DashboardStats, error)
}

type dashboardService struct {
	repo repo.DashboardRepository
}

func NewDashboardService(r repo.DashboardRepository) DashboardService {
	return &dashboardService{repo: r}
}

func (s *dashboardService) GetStats(ctx context.Context, startDate time.Time, endDate time.Time) (*model.DashboardStats, error) {
	return s.repo.GetStats(ctx, startDate, endDate)
}