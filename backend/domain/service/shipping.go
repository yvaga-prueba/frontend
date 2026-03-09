package service

import (
	"context"
	"core/domain/model"
)

type ShippingService interface {
	GetTracking(ctx context.Context, trackingNumber string) (*model.ShippingTracking, error)
}
