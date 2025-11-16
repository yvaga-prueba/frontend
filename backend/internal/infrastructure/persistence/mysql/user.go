package mysql

import (
	"context"
	"database/sql"
	"fmt"
	"log"

	"core/internal/domain/entity"
	domainerrors "core/internal/domain/errors"
	"core/internal/domain/repository"
)

type UserRepository struct {
	Conn *sql.DB
}

func NewUserRepository(conn *sql.DB) *UserRepository {
	return &UserRepository{conn}
}

var _ repository.UserRepository = (*UserRepository)(nil)

func (m *UserRepository) GetByEmail(ctx context.Context, email string) (res entity.User, err error) {
	query := `SELECT id, first_name, last_name, email, password, google_id, ios_id, provider, role, updated_at, created_at 
	          FROM users 
	          WHERE email = ?`

	var password, googleID, iosID, provider sql.NullString

	err = m.Conn.QueryRowContext(ctx, query, email).Scan(
		&res.ID,
		&res.FirstName,
		&res.LastName,
		&res.Email,
		&password,
		&googleID,
		&iosID,
		&provider,
		&res.Role,
		&res.UpdatedAt,
		&res.CreatedAt,
	)

	if err != nil {
		if err == sql.ErrNoRows {
			return res, domainerrors.ErrNotFound
		}
		return res, err
	}

	if password.Valid {
		res.Password = password.String
	}
	if googleID.Valid {
		s := googleID.String
		res.GoogleID = &s
	}
	if iosID.Valid {
		s := iosID.String
		res.IOSID = &s
	}
	if provider.Valid {
		res.Provider = provider.String
	} else {
		res.Provider = "local"
	}

	return res, nil
}

func (m *UserRepository) GetByID(ctx context.Context, id int64) (res entity.User, err error) {
	query := `SELECT id, first_name, last_name, email, password, google_id, ios_id, provider, role, updated_at, created_at 
	          FROM users 
	          WHERE id = ?`

	var password, googleID, iosID, provider sql.NullString

	err = m.Conn.QueryRowContext(ctx, query, id).Scan(
		&res.ID,
		&res.FirstName,
		&res.LastName,
		&res.Email,
		&password,
		&googleID,
		&iosID,
		&provider,
		&res.Role,
		&res.UpdatedAt,
		&res.CreatedAt,
	)

	if err != nil {
		if err == sql.ErrNoRows {
			return res, domainerrors.ErrNotFound
		}
		return res, err
	}

	if password.Valid {
		res.Password = password.String
	}
	if googleID.Valid {
		s := googleID.String
		res.GoogleID = &s
	}
	if iosID.Valid {
		s := iosID.String
		res.IOSID = &s
	}
	if provider.Valid {
		res.Provider = provider.String
	} else {
		res.Provider = "local"
	}

	return res, nil
}

func (m *UserRepository) GetByGoogleID(ctx context.Context, googleID string) (entity.User, error) {
	query := `SELECT id, first_name, last_name, email, password, google_id, ios_id, provider, role, updated_at, created_at 
	          FROM users 
	          WHERE google_id = ?`

	var user entity.User
	var password, gID, iosID, provider sql.NullString

	err := m.Conn.QueryRowContext(ctx, query, googleID).Scan(
		&user.ID,
		&user.FirstName,
		&user.LastName,
		&user.Email,
		&password,
		&gID,
		&iosID,
		&provider,
		&user.Role,
		&user.UpdatedAt,
		&user.CreatedAt,
	)

	if err != nil {
		if err == sql.ErrNoRows {
			return user, domainerrors.ErrNotFound
		}
		return user, err
	}

	if password.Valid {
		user.Password = password.String
	}
	if gID.Valid {
		s := gID.String
		user.GoogleID = &s
	}
	if iosID.Valid {
		s := iosID.String
		user.IOSID = &s
	}
	if provider.Valid {
		user.Provider = provider.String
	} else {
		user.Provider = "local"
	}

	return user, nil
}

func (m *UserRepository) Store(ctx context.Context, user *entity.User) error {
	query := `INSERT INTO users (email, first_name, last_name, password, google_id, ios_id, provider, role, created_at, updated_at) 
	          VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`

	if user.Role == "" {
		user.Role = "user"
	}

	log.Printf("[REPO] Storing user - Email: %s, Provider: %s, Role: %s", user.Email, user.Provider, user.Role)

	result, err := m.Conn.ExecContext(ctx, query,
		user.Email,
		user.FirstName,
		user.LastName,
		user.Password,
		user.GoogleID,
		user.IOSID,
		user.Provider,
		user.Role,
	)
	if err != nil {
		log.Printf("[REPO] Error storing user: %v", err)
		return err
	}

	lastID, err := result.LastInsertId()
	if err != nil {
		log.Printf("[REPO] Error getting last insert ID: %v", err)
		return err
	}

	user.ID = lastID
	log.Printf("[REPO] User stored successfully with ID: %d", user.ID)

	return nil
}

func (m *UserRepository) Update(ctx context.Context, user *entity.User) error {
	query := `UPDATE users 
	          SET first_name = ?, last_name = ?, email = ?, google_id = ?, ios_id = ?, updated_at = NOW() 
	          WHERE id = ?`

	log.Printf("[REPO] Updating user ID: %d", user.ID)

	_, err := m.Conn.ExecContext(ctx, query,
		user.FirstName,
		user.LastName,
		user.Email,
		user.GoogleID,
		user.IOSID,
		user.ID,
	)

	if err != nil {
		log.Printf("[REPO] Error updating user: %v", err)
		return err
	}

	log.Printf("[REPO] User updated successfully")
	return err
}

func (m *UserRepository) UpdatePassword(ctx context.Context, userID int64, hashedPassword string) error {
	query := `UPDATE users SET password = ?, updated_at = NOW() WHERE id = ?`
	_, err := m.Conn.ExecContext(ctx, query, hashedPassword, userID)
	return err
}

func (m *UserRepository) Delete(ctx context.Context, id int64) (err error) {
	query := "DELETE FROM users WHERE id = ?"

	stmt, err := m.Conn.PrepareContext(ctx, query)
	if err != nil {
		return
	}

	res, err := stmt.ExecContext(ctx, id)
	if err != nil {
		return
	}

	rowsAfected, err := res.RowsAffected()
	if err != nil {
		return
	}

	if rowsAfected != 1 {
		err = fmt.Errorf("weird  Behavior. Total Affected: %d", rowsAfected)
		return
	}

	return
}
