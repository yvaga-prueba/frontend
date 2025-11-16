package entity

import "time"

// UserRole representa los roles disponibles en el sistema
type UserRole string

const (
	RoleUser  UserRole = "user"  // Usuario normal
	RoleAdmin UserRole = "admin" // Administrador con permisos especiales
)

// User representa un usuario del sistema
type User struct {
	ID        int64     `json:"id"`
	FirstName string    `json:"first_name"`
	LastName  string    `json:"last_name"`
	Email     string    `json:"email"`
	Password  string    `json:"-"` // hash - no se expone en JSON
	Role      string    `json:"role"`
	GoogleID  *string   `json:"google_id,omitempty"`
	IOSID     *string   `json:"ios_id,omitempty"`
	Provider  string    `json:"provider"`
	UpdatedAt time.Time `json:"updated_at"`
	CreatedAt time.Time `json:"created_at"`
}

// IsAdmin verifica si el usuario tiene rol de administrador
func (u *User) IsAdmin() bool {
	return u.Role == string(RoleAdmin)
}

// HasRole verifica si el usuario tiene un rol específico
func (u *User) HasRole(role UserRole) bool {
	return u.Role == string(role)
}

// GetFullName retorna el nombre completo del usuario
func (u *User) GetFullName() string {
	return u.FirstName + " " + u.LastName
}
