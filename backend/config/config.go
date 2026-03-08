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

type MercadoPagoConfig struct {
	AccessToken string
	SuccessURL  string
	FailureURL  string
	PendingURL  string
	CBU         string // CBU para transferencias
	Alias       string // Alias para transferencias
	BankName    string // Nombre del banco
	AccountName string // Nombre del titular
	Enabled     bool
}

type AFIPConfig struct {
	Enabled     bool
	Environment string // testing o production
	CUIT        int64
	CertPath    string // Ruta al archivo (.crt / .pem)
	CertToken   string // Certificado en base64 (alternativa a CertPath)
	KeyPath     string // Ruta a la clave privada (.key)
	KeyToken    string // Clave privada en base64 (alternativa a KeyPath)
}

type GoogleDriveConfig struct {
	ClientID     string // OAuth2 Client ID
	ClientSecret string // OAuth2 Client Secret
	RefreshToken string // OAuth2 Refresh Token (obtenido una vez con el flujo offline)
	FolderID     string // ID de la carpeta de Drive donde se suben las imágenes
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

	SMTP        SMTPConfig
	Google      GoogleOAuthConfig
	MercadoPago MercadoPagoConfig
	AFIP        AFIPConfig
	GoogleDrive GoogleDriveConfig
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
		DBUser: getString("DATABASE_USER", "user"),
		DBPass: getString("DATABASE_PASS", "password"),
		DBName: getString("DATABASE_NAME", "core"),

		EchoDebug: getBoolString("ECHO_DEBUG", "false"),

		JWTSecret:          getString("JWT_SECRET", "dev-secret-change-me"),
		JWTExpirationHours: getInt("JWT_EXPIRATION_HOURS", 24),

		AppBaseURL:  getString("APP_BASE_URL", "http://localhost:8080"),
		FrontendURL: getString("FRONTEND_URL", "http://localhost:4200"),
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

	cfg.MercadoPago = MercadoPagoConfig{
		AccessToken: getString("MP_ACCESS_TOKEN", ""),
		SuccessURL:  getString("MP_SUCCESS_URL", cfg.FrontendURL+"/cart/success"),
		FailureURL:  getString("MP_FAILURE_URL", cfg.FrontendURL+"/cart/failure"),
		PendingURL:  getString("MP_PENDING_URL", cfg.FrontendURL+"/cart/pending"),
		CBU:         getString("MP_TRANSFER_CBU", ""),
		Alias:       getString("MP_TRANSFER_ALIAS", ""),
		BankName:    getString("MP_TRANSFER_BANK", ""),
		AccountName: getString("MP_TRANSFER_ACCOUNT", ""),
	}
	cfg.MercadoPago.Enabled = cfg.MercadoPago.AccessToken != ""

	cfg.AFIP = AFIPConfig{
		Enabled:     getBool("AFIP_ENABLED", false),
		Environment: getString("AFIP_ENVIRONMENT", "testing"),
		CUIT:        int64(getInt("AFIP_CUIT", 0)),
		CertPath:    getString("AFIP_CERT_PATH", ""),
		CertToken:   getString("AFIP_CERT_TOKEN", ""),
		KeyPath:     getString("AFIP_KEY_PATH", ""),
		KeyToken:    getString("AFIP_KEY_TOKEN", ""),
	}

	cfg.GoogleDrive = GoogleDriveConfig{
		ClientID:     getString("GDRIVE_CLIENT_ID", ""),
		ClientSecret: getString("GDRIVE_CLIENT_SECRET", ""),
		RefreshToken: getString("GDRIVE_REFRESH_TOKEN", ""),
		FolderID:     getString("GDRIVE_FOLDER_ID", ""),
	}
	cfg.GoogleDrive.Enabled = cfg.GoogleDrive.ClientID != "" &&
		cfg.GoogleDrive.ClientSecret != "" &&
		cfg.GoogleDrive.RefreshToken != "" &&
		cfg.GoogleDrive.FolderID != ""

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

// getBytes devuelve el valor de la variable de entorno como []byte, útil para JSONs inlined.
func getBytes(key string) []byte {
	if v := strings.TrimSpace(os.Getenv(key)); v != "" {
		return []byte(v)
	}
	return nil
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
