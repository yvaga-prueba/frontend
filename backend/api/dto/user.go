package dto

import "core/domain/model"

type LoginRequest struct {
	Email    string `json:"email" example:"user@example.com"`
	Password string `json:"password" example:"secret123"`
}

type LoginResponse struct {
	AccessToken string `json:"access_token" example:"eyJhbGciOiJIUzI1NiIsInR..."`
	TokenType   string `json:"token_type" example:"Bearer"`
	ExpiresIn   int64  `json:"expires_in" example:"3600"`
}

type GoogleLoginRequest struct {
	IDToken string `json:"id_token" example:"eyJhbGciOiJSUzI1NiIsImtpZCI6Ij..."`
}

type RegisterRequest struct {
	FirstName string `json:"first_name" example:"John"`
	LastName  string `json:"last_name" example:"Doe"`
	Email     string `json:"email" example:"john.doe@example.com"`
	Password  string `json:"password" example:"secret123"`
}

func FromUserEntity(u model.User) UserResponse {
	return UserResponse{
		ID:        u.ID,
		FirstName: u.FirstName,
		LastName:  u.LastName,
		Email:     u.Email,
		Role:      u.Role,
		Provider:  u.Provider,
	}
}

type UserResponse struct {
	ID        int64  `json:"id" example:"1"`
	FirstName string `json:"first_name" example:"Juan"`
	LastName  string `json:"last_name" example:"Pérez"`
	Email     string `json:"email" example:"juan@example.com"`
	DNI       string `json:"dni"`   // nuevos
	Phone     string `json:"phone"` // 
	Provider  string `json:"provider" example:"local"`
	Role      string `json:"role" example:"user"`
}

type RegisterResponse struct {
	User        UserResponse `json:"user"`
	AccessToken string       `json:"access_token" example:"eyJhbGciOiJIUzI1NiIsInR..."`
	TokenType   string       `json:"token_type" example:"Bearer"`
	ExpiresIn   int64        `json:"expires_in" example:"3600"`
}

type ErrorGeneral struct {
	Message string `json:"message" example:"Error message"`
}
