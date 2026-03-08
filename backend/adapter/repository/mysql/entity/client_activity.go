package entity

import (
	"context"
	"core/domain/model"
	"core/domain/repo"
	"database/sql"
)

type clientActivityRepo struct {
	db *sql.DB
}

func NewClientActivityRepository(db *sql.DB) repo.ClientActivityRepository {
	return &clientActivityRepo{db: db}
}

func (r *clientActivityRepo) Create(ctx context.Context, activity *model.ClientActivity) error {
	query := `INSERT INTO client_activities (event_type, path, metadata, created_at) VALUES (?, ?, ?, NOW())`
	_, err := r.db.ExecContext(ctx, query, activity.EventType, activity.Path, activity.Metadata)
	return err
}

func (r *clientActivityRepo) ListRecent(ctx context.Context, limit int) ([]model.ClientActivity, error) {
	query := `SELECT id, event_type, path, metadata, created_at FROM client_activities ORDER BY id DESC LIMIT ?`
	rows, err := r.db.QueryContext(ctx, query, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var res []model.ClientActivity
	for rows.Next() {
		var act model.ClientActivity
		var meta sql.NullString
		if err := rows.Scan(&act.ID, &act.EventType, &act.Path, &meta, &act.CreatedAt); err != nil {
			return nil, err
		}
		if meta.Valid {
			act.Metadata = meta.String
		}
		res = append(res, act)
	}
	return res, nil
}
