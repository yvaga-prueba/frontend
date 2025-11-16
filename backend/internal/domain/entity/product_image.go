package entity

import "time"

type ProductImage struct {
	ID        int64     `json:"id"`
	ProductID int64     `json:"product_id"`
	URL       string    `json:"url"`
	IsPrimary bool      `json:"is_primary"`
	Position  int       `json:"position"`
	CreatedAt time.Time `json:"created_at"`
}
