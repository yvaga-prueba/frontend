package service

import (
	"context"
	"core/domain/model"
	"core/domain/repo"
)

type ClientActivityService interface {
	Record(ctx context.Context, eventType, path string, metadata string) error
	ListRecent(ctx context.Context, limit int) ([]model.ClientActivity, error)
}

type clientActivityService struct {
	repo repo.ClientActivityRepository
}

func NewClientActivityService(r repo.ClientActivityRepository) ClientActivityService {
	return &clientActivityService{repo: r}
}

func (s *clientActivityService) Record(ctx context.Context, eventType, path string, metadata string) error {
	act := &model.ClientActivity{
		EventType: eventType,
		Path:      path,
		Metadata:  metadata,
	}
	return s.repo.Create(ctx, act)
}

func (s *clientActivityService) ListRecent(ctx context.Context, limit int) ([]model.ClientActivity, error) {
	return s.repo.ListRecent(ctx, limit)
}
