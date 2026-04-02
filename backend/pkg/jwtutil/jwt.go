package jwtutil

import (
	"core/config"
	"net/http"
	"time"

	"github.com/golang-jwt/jwt/v5"
	echojwt "github.com/labstack/echo-jwt/v4"
	echo "github.com/labstack/echo/v4"
)

type Claims struct {
	UserID int64  `json:"user_id"`
	Email  string `json:"email"`
	Role   string `json:"role"`
	jwt.RegisteredClaims
}

func GenerateToken(userID int64, email, role, secret string, expirationHours int) (string, error) {
	now := time.Now()
	if expirationHours <= 0 {
		expirationHours = 24
	}
	claims := Claims{
		UserID: userID,
		Email:  email,
		Role:   role,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(now.Add(time.Duration(expirationHours) * time.Hour)),
			IssuedAt:  jwt.NewNumericDate(now),
			NotBefore: jwt.NewNumericDate(now),
		},
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(secret))
}

// JWTMiddleware devuelve un middleware de Echo que valida el JWT
func JWTMiddleware(cfg *config.Config) echo.MiddlewareFunc {
	return echojwt.WithConfig(echojwt.Config{
		SigningKey:  []byte(cfg.JWTSecret),
		TokenLookup: "header:Authorization:Bearer ",
		ErrorHandler: func(c echo.Context, err error) error {
			return c.JSON(http.StatusUnauthorized, map[string]string{
				"message": "invalid or missing token",
			})
		},
		SuccessHandler: func(c echo.Context) {
			// Extraer claims y guardarlos en el contexto
			user := c.Get("user")
			if token, ok := user.(*jwt.Token); ok {
				if claims, ok := token.Claims.(jwt.MapClaims); ok {
					if userID, ok := claims["user_id"].(float64); ok {
						c.Set("user_id", int64(userID))
					}
					if email, ok := claims["email"].(string); ok {
						c.Set("email", email)
					}
					if role, ok := claims["role"].(string); ok {
						c.Set("role", role)
					}
				}
			}
		},
	})
}

// UserFromToken es un helper opcional para extraer datos del token
func UserFromToken(c echo.Context) (map[string]interface{}, bool) {
	user := c.Get("user")
	if user == nil {
		return nil, false
	}

	token, ok := user.(*jwt.Token)
	if !ok {
		return nil, false
	}

	claims, ok := token.Claims.(jwt.MapClaims)
	if !ok {
		return nil, false
	}

	data := map[string]interface{}{}
	for k, v := range claims {
		data[k] = v
	}

	return data, true
}

// GetUserIDFromContext extrae el ID del usuario logueado desde el contexto
func GetUserIDFromContext(c echo.Context) int64 {
	userID := c.Get("user_id")
	if userID == nil {
		return 0
	}
	
	// Si el middleware lo guardó como int64
	if id, ok := userID.(int64); ok {
		return id
	}
	
	// Si viene directamente de claims suele ser float64
	if id, ok := userID.(float64); ok {
		return int64(id)
	}
	
	return 0
}