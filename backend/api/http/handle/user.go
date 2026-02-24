package handle

import (
	"database/sql"
	"net/http"
	"strings"

	"core/api/dto"
	errorcode "core/api/error_code"
	"core/config"
	"core/domain/model"
	"core/domain/repo"
	"core/pkg/jwtutil"

	"cloud.google.com/go/auth/credentials/idtoken"
	"github.com/golang-jwt/jwt/v5"
	"github.com/labstack/echo/v4"
	"golang.org/x/crypto/bcrypt"
)

type AuthHandler struct {
	userRepo repo.UserRepository
	cfg      config.Config
}

func NewAuthHandler(userRepo repo.UserRepository, cfg config.Config) *AuthHandler {
	return &AuthHandler{
		userRepo: userRepo,
		cfg:      cfg,
	}
}

// Register godoc
// @Summary      Registrar usuario local
// @Description  Registra un nuevo usuario con email y contraseña y devuelve JWT + datos del usuario.
// @Tags         auth
// @Accept       json
// @Produce      json
// @Param        user  body      dto.RegisterRequest  true  "Datos de registro"
// @Success      201   {object}  dto.RegisterResponse
// @Router       /api/auth/register [post]
func (h *AuthHandler) Register(c echo.Context) error {
	var req dto.RegisterRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, dto.ErrorGeneral{Message: "invalid request body"})
	}

	if req.Email == "" || req.Password == "" {
		return c.JSON(http.StatusBadRequest, dto.ErrorGeneral{Message: "email and password are required"})
	}

	// Verificar si ya existe
	_, err := h.userRepo.GetByEmail(c.Request().Context(), req.Email)
	if err == nil {
		return c.JSON(http.StatusConflict, dto.ErrorGeneral{Message: "email already in use"})
	}
	if err != nil && err != errorcode.ErrNotFound {
		return c.JSON(http.StatusInternalServerError, dto.ErrorGeneral{Message: "internal error"})
	}

	// Hash password
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, dto.ErrorGeneral{Message: "error hashing password"})
	}

	// Crear user
	user := &model.User{
		FirstName: req.FirstName,
		LastName:  req.LastName,
		Email:     req.Email,
		Password:  string(hashedPassword),
		Provider:  "local",
		Role:      "user",
	}

	if err := h.userRepo.Store(c.Request().Context(), user); err != nil {
		return c.JSON(http.StatusInternalServerError, dto.ErrorGeneral{Message: "error saving user"})
	}

	// Generar JWT
	tokenString, err := jwtutil.GenerateToken(user.ID, user.Email, user.Role, h.cfg.JWTSecret, h.cfg.JWTExpirationHours)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, dto.ErrorGeneral{Message: "error generating token"})
	}

	resp := dto.RegisterResponse{
		User:        dto.FromUserEntity(*user),
		AccessToken: tokenString,
		TokenType:   "Bearer",
		ExpiresIn:   int64(h.cfg.JWTExpirationHours) * 3600,
	}

	return c.JSON(http.StatusCreated, resp)
}

// Login godoc
// @Summary      Login (email y password)
// @Description  Autenticación local. Devuelve JWT y datos básicos del usuario.
// @Tags         auth
// @Accept       json
// @Produce      json
// @Param        credentials  body      dto.LoginRequest   true  "Credenciales de acceso"
// @Success      200          {object}  dto.LoginResponse
// @Router       /api/auth/login [post]
func (h *AuthHandler) Login(c echo.Context) error {
	ctx := c.Request().Context()

	var req dto.LoginRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid request"})
	}

	user, err := h.userRepo.GetByEmail(ctx, req.Email)
	if err != nil {
		return c.JSON(http.StatusUnauthorized, map[string]string{"error": "invalid credentials"})
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.Password), []byte(req.Password)); err != nil {
		return c.JSON(http.StatusUnauthorized, map[string]string{"error": "invalid credentials"})
	}

	tokenString, err := jwtutil.GenerateToken(user.ID, user.Email, user.Role, h.cfg.JWTSecret, h.cfg.JWTExpirationHours)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, dto.ErrorGeneral{Message: "error generating token"})
	}

	return c.JSON(http.StatusOK, dto.LoginResponse{
		AccessToken: tokenString,
		TokenType:   "Bearer",
		ExpiresIn:   int64(h.cfg.JWTExpirationHours) * 3600,
	})
}

// GoogleLogin godoc
// @Summary      Login con Google (redirect)
// @Description  Redirecciona al usuario a la página de login de Google.
// @Tags         auth
// @Produce      json
// @Success      302  "Redirección a Google"
// @Router       /api/auth/google/login [get]
func (h *AuthHandler) GoogleLogin(c echo.Context) error {
	ctx := c.Request().Context()

	var req dto.GoogleLoginRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid request"})
	}

	if !h.cfg.Google.Enabled || h.cfg.Google.ClientID == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "google auth not configured"})
	}

	payload, err := idtoken.Validate(ctx, req.IDToken, h.cfg.Google.ClientID)
	if err != nil {
		return c.JSON(http.StatusUnauthorized, map[string]string{"error": "invalid google token"})
	}

	email, _ := payload.Claims["email"].(string)
	name, _ := payload.Claims["name"].(string)
	sub := payload.Subject // google user id

	if email == "" {
		return c.JSON(http.StatusUnauthorized, map[string]string{"error": "google token has no email"})
	}

	user, err := h.userRepo.GetByGoogleID(ctx, sub)
	if err != nil && err != sql.ErrNoRows {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "failed to find user"})
	}

	if err == sql.ErrNoRows {
		firstName, lastName := splitName(name)

		user = model.User{
			FirstName: firstName,
			LastName:  lastName,
			Email:     email,
			Provider:  "google",
			Role:      "user",
		}
		user.GoogleID = &sub

		if err := h.userRepo.Store(ctx, &user); err != nil {
			return c.JSON(http.StatusInternalServerError, map[string]string{"error": "failed to create user"})
		}
	}

	tokenString, err := jwtutil.GenerateToken(user.ID, user.Email, user.Role, h.cfg.JWTSecret, h.cfg.JWTExpirationHours)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, dto.ErrorGeneral{Message: "error generating token"})
	}

	return c.JSON(http.StatusOK, dto.LoginResponse{
		AccessToken: tokenString,
		TokenType:   "Bearer",
		ExpiresIn:   int64(h.cfg.JWTExpirationHours) * 3600,
	})
}

// Me godoc
// @Summary      Obtener usuario autenticado
// @Description  Devuelve la información del usuario actual basada en el JWT.
// @Tags         auth
// @Produce      json
// @Success      200  {object}  dto.UserResponse
// @Security     BearerAuth
// @Router       /api/auth/me [get]
func (h *AuthHandler) Me(c echo.Context) error {
	// Obtener el token del contexto
	user := c.Get("user")
	if user == nil {
		return c.JSON(http.StatusUnauthorized, dto.ErrorGeneral{Message: "unauthorized"})
	}

	// Convertir a *jwt.Token
	token, ok := user.(*jwt.Token)
	if !ok {
		return c.JSON(http.StatusUnauthorized, dto.ErrorGeneral{Message: "invalid token"})
	}

	// Extraer claims
	claims, ok := token.Claims.(jwt.MapClaims)
	if !ok {
		return c.JSON(http.StatusUnauthorized, dto.ErrorGeneral{Message: "invalid claims"})
	}

	// Obtener user_id
	userIDFloat, ok := claims["user_id"].(float64)
	if !ok {
		return c.JSON(http.StatusUnauthorized, dto.ErrorGeneral{Message: "invalid user_id"})
	}

	userID := int64(userIDFloat)

	// Buscar usuario en BD
	foundUser, err := h.userRepo.GetByID(c.Request().Context(), userID)
	if err != nil {
		return c.JSON(http.StatusNotFound, dto.ErrorGeneral{Message: "user not found"})
	}

	return c.JSON(http.StatusOK, dto.FromUserEntity(foundUser))
}

// splitName splits a full name into first and last name
func splitName(fullName string) (string, string) {
	parts := strings.Fields(fullName)
	if len(parts) == 0 {
		return "", ""
	}
	if len(parts) == 1 {
		return parts[0], ""
	}
	return parts[0], strings.Join(parts[1:], " ")
}
