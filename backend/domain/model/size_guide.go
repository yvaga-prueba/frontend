package model

import "time"

type SizeGuide struct {
	ID        int64     `json:"id" db:"id"`
	Category  string    `json:"category" db:"category"`
	Size      string    `json:"size" db:"size"`
	MinWeight float64   `json:"min_weight" db:"min_weight"`
	MaxWeight float64   `json:"max_weight" db:"max_weight"`
	MinHeight float64   `json:"min_height" db:"min_height"`
	MaxHeight float64   `json:"max_height" db:"max_height"`
	ChestCm   float64   `json:"chest_cm"` // guia de talles
	WaistCm   float64   `json:"waist_cm"`
	HipCm     float64   `json:"hip_cm"`
	LengthCm  float64   `json:"length_cm"`// guia de talles 
	CreatedAt time.Time `json:"created_at" db:"created_at"`
	UpdatedAt time.Time `json:"updated_at" db:"updated_at"`
}
