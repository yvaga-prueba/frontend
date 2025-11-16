package dto

import "time"

type ProductImageResponse struct {
	ID        int64     `json:"id" example:"1"`
	ProductID int64     `json:"product_id" example:"1"`
	URL       string    `json:"url" example:"/static/products/1/image.jpg"`
	IsPrimary bool      `json:"is_primary" example:"true"`
	Position  int       `json:"position" example:"0"`
	CreatedAt time.Time `json:"created_at" example:"2025-01-15T10:00:00Z"`
}

type UploadImageRequest struct {
	IsPrimary bool `form:"is_primary" example:"false"`
	Position  int  `form:"position" example:"0"`
}
