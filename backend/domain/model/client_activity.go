package model

import "time"

type ClientActivity struct {
	ID        int64      `json:"id"`
	EventType string     `json:"event_type"`
	Path      string     `json:"path"`
	Metadata  string     `json:"metadata"` // Guardado como json string internamente
	CreatedAt *time.Time `json:"created_at"`
}
