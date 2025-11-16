package config

import (
	"fmt"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/joho/godotenv"
)

type SMTPConfig struct {
	Host      string
	Port      int
	User      string
	Password  string
	FromName  string
	FromEmail string
	Enabled   bool
}

type GoogleOAuthConfig struct {
	ClientID     string
	ClientSecret string
	RedirectURL  string
	Enabled      bool
}

type Config struct {
	Debug          bool
	ServerAddress  string
	ContextTimeout time.Duration

	DBHost string
	DBPort string
	DBUser string
	DBPass string
	DBName string
	DSN    string // mysql DSN construida

	EchoDebug bool

	JWTSecret          string
	JWTExpirationHours int

	AppBaseURL  string
	FrontendURL string

	SMTP   SMTPConfig
	Google GoogleOAuthConfig
}

func Load() (Config, error) {
	// Cargar .env si existe
	_ = godotenv.Load()

	cfg := Config{
		Debug:          getBool("DEBUG", false),
		ServerAddress:  getString("SERVER_ADDRESS", ":8080"),
		ContextTimeout: getDurationSeconds("CONTEXT_TIMEOUT", 2) * time.Second,

		DBHost: getString("DATABASE_HOST", "localhost"),
		DBPort: getString("DATABASE_PORT", "3306"),
		DBUser: getString("DATABASE_USER", "root"),
		DBPass: getString("DATABASE_PASS", ""),
		DBName: getString("DATABASE_NAME", ""),

		EchoDebug: getBoolString("ECHO_DEBUG", "false"),

		JWTSecret:          getString("JWT_SECRET", "dev-secret-change-me"),
		JWTExpirationHours: getInt("JWT_EXPIRATION_HOURS", 24),

		AppBaseURL:  getString("APP_BASE_URL", "http://localhost:8080"),
		FrontendURL: getString("FRONTEND_URL", "http://localhost:3000"),
	}

	cfg.DSN = fmt.Sprintf("%s:%s@tcp(%s:%s)/%s?parseTime=true&collation=utf8mb4_unicode_ci",
		cfg.DBUser, cfg.DBPass, cfg.DBHost, cfg.DBPort, cfg.DBName,
	)

	smtpPort := getInt("SMTP_PORT", 587)
	cfg.SMTP = SMTPConfig{
		Host:      getString("SMTP_HOST", ""),
		Port:      smtpPort,
		User:      getString("SMTP_USER", ""),
		Password:  getString("SMTP_PASSWORD", ""),
		FromEmail: getString("SMTP_FROM_EMAIL", ""),
		FromName:  getString("SMTP_FROM_NAME", "App"),
	}
	cfg.SMTP.Enabled = cfg.SMTP.Host != "" && cfg.SMTP.FromEmail != ""

	cfg.Google = GoogleOAuthConfig{
		ClientID:     getString("GOOGLE_CLIENT_ID", ""),
		ClientSecret: getString("GOOGLE_CLIENT_SECRET", ""),
		RedirectURL:  getString("GOOGLE_REDIRECT_URL", ""),
	}
	cfg.Google.Enabled = cfg.Google.ClientID != "" && cfg.Google.ClientSecret != "" && cfg.Google.RedirectURL != ""

	if cfg.DBName == "" {
		return cfg, fmt.Errorf("DATABASE_NAME es requerido")
	}
	if cfg.JWTSecret == "" {
		return cfg, fmt.Errorf("JWT_SECRET es requerido")
	}
	return cfg, nil
}

func getString(key, def string) string {
	if v := strings.TrimSpace(os.Getenv(key)); v != "" {
		return v
	}
	return def
}

func getInt(key string, def int) int {
	if v := strings.TrimSpace(os.Getenv(key)); v != "" {
		if n, err := strconv.Atoi(v); err == nil {
			return n
		}
	}
	return def
}

func getBool(key string, def bool) bool {
	if v := strings.TrimSpace(os.Getenv(key)); v != "" {
		switch strings.ToLower(v) {
		case "1", "true", "t", "yes", "y":
			return true
		case "0", "false", "f", "no", "n":
			return false
		}
	}
	return def
}

func getBoolString(key, def string) bool {
	d := strings.ToLower(def)
	v := strings.ToLower(strings.TrimSpace(os.Getenv(key)))
	if v == "" {
		v = d
	}
	return v == "1" || v == "true" || v == "t" || v == "yes" || v == "y"
}

func getDurationSeconds(key string, def int) time.Duration {
	sec := getInt(key, def)
	return time.Duration(sec)
}
