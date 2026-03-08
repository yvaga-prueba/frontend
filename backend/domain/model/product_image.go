package model

import "time"

type ProductImage struct {
	ID          int64     `json:"id"`
	ProductID   int64     `json:"product_id"`
	URL         string    `json:"url"`
	DriveFileID string    `json:"drive_file_id,omitempty"` // ID del archivo en Google Drive (para poder eliminarlo)
	IsPrimary   bool      `json:"is_primary"`
	Position    int       `json:"position"`
	CreatedAt   time.Time `json:"created_at"`
}
