package model

import "time"

type Favorite struct {
	UserID    int64     `json:"user_id"`
	ProductID int64     `json:"product_id"`
	CreatedAt time.Time `json:"created_at"`
}