package repo

import (
	"context"
	"database/sql"
)

type SettingRepo interface {
	GetSetting(ctx context.Context, key string) (string, error)
	SetSetting(ctx context.Context, key string, value string) error
}

type settingRepo struct {
	db *sql.DB
}

func NewSettingRepo(db *sql.DB) SettingRepo {
	return &settingRepo{db: db}
}

func (r *settingRepo) GetSetting(ctx context.Context, key string) (string, error) {
	var value string
	err := r.db.QueryRowContext(ctx, "SELECT value FROM settings WHERE `key` = ?", key).Scan(&value)
	if err == sql.ErrNoRows {
		return "", nil // Si no existe, no rompemos nada, devolvemos vacío
	}
	return value, err
}

func (r *settingRepo) SetSetting(ctx context.Context, key string, value string) error {
	// Esto actualiza el valor si ya existe, o lo crea si es nuevo
	_, err := r.db.ExecContext(ctx, 
		"INSERT INTO settings (`key`, value) VALUES (?, ?) ON DUPLICATE KEY UPDATE value = ?", 
		key, value, value)
	return err
}