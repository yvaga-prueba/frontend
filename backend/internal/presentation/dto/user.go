package dto

import "core/internal/domain/entity"

type UserResponse struct {
	ID        int64  `json:"id" example:"1"`
	FirstName string `json:"first_name" example:"Juan"`
	LastName  string `json:"last_name" example:"Pérez"`
	Email     string `json:"email" example:"juan@example.com"`
	Provider  string `json:"provider" example:"local"`
	Role      string `json:"role" example:"user"`
}

func FromUserEntity(u entity.User) UserResponse {
	return UserResponse{
		ID:        u.ID,
		FirstName: u.FirstName,
		LastName:  u.LastName,
		Email:     u.Email,
		Provider:  u.Provider,
		Role:      u.Role,
	}
}

type RegisterRequest struct {
	FirstName string `json:"first_name" example:"Juan"`
	LastName  string `json:"last_name" example:"Pérez"`
	Email     string `json:"email" example:"juan@example.com"`
	Password  string `json:"password" example:"123456"`
}

type RegisterResponse struct {
	Token string       `json:"token" example:"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."` // JWT
	User  UserResponse `json:"user"`
}
