package entity

import (
	"context"
	"database/sql"
	"fmt"
	"log"

	errorcode "core/api/error_code"
	"core/domain/model"
	"core/domain/repo"
)

type SQLRepository struct {
	Conn *sql.DB
}

func NewUserRepository(conn *sql.DB) *SQLRepository {
	return &SQLRepository{conn}
}

var _ repo.UserRepository = (*SQLRepository)(nil)

func (m *SQLRepository) GetByEmail(ctx context.Context, email string) (res model.User, err error) {
	query := `SELECT id, first_name, last_name, email, password, google_id, ios_id, provider, role, updated_at, created_at, dni, phone
			  FROM users 
			  WHERE email = ?`

	var googleID, iosID, dniNull, phoneNull sql.NullString
	err = m.Conn.QueryRowContext(ctx, query, email).Scan(
		&res.ID,
		&res.FirstName,
		&res.LastName,
		&res.Email,
		&res.Password,
		&googleID,
		&iosID,
		&res.Provider,
		&res.Role,
		&res.UpdatedAt,
		&res.CreatedAt,
		&dniNull,
		&phoneNull,
	)

	if googleID.Valid {
		res.GoogleID = &googleID.String
	}
	if iosID.Valid {
		res.IOSID = &iosID.String
	}
	if dniNull.Valid {
		res.DNI = dniNull.String
	}
	if phoneNull.Valid {
		res.Phone = phoneNull.String
	}

	if err == sql.ErrNoRows {
		return res, errorcode.ErrNotFound
	}

	return res, err
}

func (m *SQLRepository) GetByGoogleID(ctx context.Context, googleID string) (model.User, error) {
	query := `SELECT id, first_name, last_name, email, password, google_id, ios_id, provider, role, updated_at, created_at, dni, phone 
			  FROM users 
			  WHERE google_id = ?`

	var res model.User
	var gid, iosID, dniNull, phoneNull sql.NullString
	err := m.Conn.QueryRowContext(ctx, query, googleID).Scan(
		&res.ID,
		&res.FirstName,
		&res.LastName,
		&res.Email,
		&res.Password,
		&gid,
		&iosID,
		&res.Provider,
		&res.Role,
		&res.UpdatedAt,
		&res.CreatedAt,
		&dniNull,
		&phoneNull,
	)

	if gid.Valid {
		res.GoogleID = &gid.String
	}
	if iosID.Valid {
		res.IOSID = &iosID.String
	}
	if dniNull.Valid {
		res.DNI = dniNull.String
	}
	if phoneNull.Valid {
		res.Phone = phoneNull.String
	}

	if err == sql.ErrNoRows {
		return res, errorcode.ErrNotFound
	}

	return res, err
}

func (m *SQLRepository) GetByIOSID(ctx context.Context, iosID string) (model.User, error) {
	query := `SELECT id, first_name, last_name, email, password, google_id, ios_id, provider, role, updated_at, created_at, dni, phone 
			  FROM users 
			  WHERE ios_id = ?`

	var res model.User
	var googleID, iid, dniNull, phoneNull sql.NullString
	err := m.Conn.QueryRowContext(ctx, query, iosID).Scan(
		&res.ID,
		&res.FirstName,
		&res.LastName,
		&res.Email,
		&res.Password,
		&googleID,
		&iid,
		&res.Provider,
		&res.Role,
		&res.UpdatedAt,
		&res.CreatedAt,
		&dniNull,
		&phoneNull,
	)

	if googleID.Valid {
		res.GoogleID = &googleID.String
	}
	if iid.Valid {
		res.IOSID = &iid.String
	}
	if dniNull.Valid {
		res.DNI = dniNull.String
	}
	if phoneNull.Valid {
		res.Phone = phoneNull.String
	}

	if err == sql.ErrNoRows {
		return res, errorcode.ErrNotFound
	}

	return res, err
}

func (m *SQLRepository) GetByID(ctx context.Context, id int64) (model.User, error) {
	query := `SELECT id, first_name, last_name, email, password, google_id, ios_id, provider, role, updated_at, created_at, dni, phone 
			  FROM users 
			  WHERE id = ?`

	var res model.User
	var googleID, iosID, dniNull, phoneNull sql.NullString
	err := m.Conn.QueryRowContext(ctx, query, id).Scan(
		&res.ID,
		&res.FirstName,
		&res.LastName,
		&res.Email,
		&res.Password,
		&googleID,
		&iosID,
		&res.Provider,
		&res.Role,
		&res.UpdatedAt,
		&res.CreatedAt,
		&dniNull,
		&phoneNull,
	)

	if googleID.Valid {
		res.GoogleID = &googleID.String
	}
	if iosID.Valid {
		res.IOSID = &iosID.String
	}
	if dniNull.Valid {
		res.DNI = dniNull.String
	}
	if phoneNull.Valid {
		res.Phone = phoneNull.String
	}

	if err == sql.ErrNoRows {
		return res, errorcode.ErrNotFound
	}

	return res, err
}

func (m *SQLRepository) Store(ctx context.Context, user *model.User) error {
	query := `INSERT INTO users (first_name, last_name, email, password, google_id, ios_id, provider, role, created_at, updated_at, dni, phone) 
			  VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW(), ?, ?)`

	var googleID, iosID interface{}
	if user.GoogleID != nil {
		googleID = *user.GoogleID
	}
	if user.IOSID != nil {
		iosID = *user.IOSID
	}

	result, err := m.Conn.ExecContext(ctx, query,
		user.FirstName,
		user.LastName,
		user.Email,
		user.Password,
		googleID,
		iosID,
		user.Provider,
		user.Role,
		user.DNI,
		user.Phone,
	)
	if err != nil {
		log.Printf("Error inserting user: %v", err)
		return err
	}

	id, err := result.LastInsertId()
	if err != nil {
		return err
	}

	user.ID = id
	return nil
}

func (m *SQLRepository) Update(ctx context.Context, user *model.User) error {
	query := `UPDATE users 
			  SET first_name = ?, last_name = ?, email = ?, password = ?, google_id = ?, ios_id = ?, provider = ?, role = ?, updated_at = NOW(), dni = ?, phone = ? 
			  WHERE id = ?`

	var googleID, iosID interface{}
	if user.GoogleID != nil {
		googleID = *user.GoogleID
	}
	if user.IOSID != nil {
		iosID = *user.IOSID
	}

	result, err := m.Conn.ExecContext(ctx, query,
		user.FirstName,
		user.LastName,
		user.Email,
		user.Password,
		googleID,
		iosID,
		user.Provider,
		user.Role,
		user.DNI,
		user.Phone,
		user.ID,
	)
	if err != nil {
		return err
	}

	rows, err := result.RowsAffected()
	if err != nil {
		return err
	}

	if rows == 0 {
		return fmt.Errorf("user not found")
	}

	return nil
}

func (m *SQLRepository) UpdatePassword(ctx context.Context, userID int64, hashedPassword string) error {
	query := `UPDATE users SET password = ?, updated_at = NOW() WHERE id = ?`

	result, err := m.Conn.ExecContext(ctx, query, hashedPassword, userID)
	if err != nil {
		return err
	}

	rows, err := result.RowsAffected()
	if err != nil {
		return err
	}

	if rows == 0 {
		return fmt.Errorf("user not found")
	}

	return nil
}

func (m *SQLRepository) Delete(ctx context.Context, id int64) error {
	query := `DELETE FROM users WHERE id = ?`

	result, err := m.Conn.ExecContext(ctx, query, id)
	if err != nil {
		return err
	}

	rows, err := result.RowsAffected()
	if err != nil {
		return err
	}

	if rows == 0 {
		return fmt.Errorf("user not found")
	}

	return nil
}