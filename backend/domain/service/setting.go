package service

import (
	"context"
	"core/domain/repo"
)

type SettingService struct {
	repo repo.SettingRepo
}

func NewSettingService(r repo.SettingRepo) *SettingService {
	return &SettingService{repo: r}
}

func (s *SettingService) GetMonthlyGoal(ctx context.Context) (string, error) {
	val, err := s.repo.GetSetting(ctx, "monthly_goal")
	if val == "" {
		return "1000000", err // Si por alguna razón está vacío, devolvemos 1 millón por defecto
	}
	return val, err
}

func (s *SettingService) SetMonthlyGoal(ctx context.Context, val string) error {
	return s.repo.SetSetting(ctx, "monthly_goal", val)
}