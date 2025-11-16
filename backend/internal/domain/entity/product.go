package entity

import "time"

type Product struct {
	ID          int64     `json:"id"`
	BarCode     int64     `json:"bar_code"`
	Title       string    `json:"title"`
	Description string    `json:"description"`
	Stock       int64     `json:"stock"`
	Size        string    `json:"size"` // S,M,L,XL,XXL
	Category    string    `json:"category"`
	UnitPrice   float64   `json:"unit_price"`
	UpdatedAt   time.Time `json:"updated_at"`
	CreatedAt   time.Time `json:"created_at"`
}

type ProductFilter struct {
	Category string
	Size     string
	Query    string
	Limit    int
	Offset   int
}
