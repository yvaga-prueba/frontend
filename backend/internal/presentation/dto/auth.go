package dto

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
