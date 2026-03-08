// cmd/gdrive_auth/main.go
//
// Helper de una sola ejecución para obtener el GDRIVE_REFRESH_TOKEN.
//
// Uso:
//
//	GDRIVE_CLIENT_ID=xxx GDRIVE_CLIENT_SECRET=yyy go run ./cmd/gdrive_auth/...
//
// O bien con el .env cargado:
//
//	go run ./cmd/gdrive_auth/...
//
// El programa:
// 1. Imprime una URL de autorización — la abrís en el navegador con tu cuenta Google
// 2. Google te da un código de autorización — lo pegás en la terminal
// 3. El programa imprime el REFRESH_TOKEN listo para copiar al .env
package main

import (
	"bufio"
	"context"
	"fmt"
	"log"
	"os"
	"strings"

	"github.com/joho/godotenv"
	"golang.org/x/oauth2"
	"golang.org/x/oauth2/google"
	"google.golang.org/api/drive/v3"
)

func main() {
	// Cargar .env si existe
	_ = godotenv.Load()

	clientID := strings.TrimSpace(os.Getenv("GDRIVE_CLIENT_ID"))
	clientSecret := strings.TrimSpace(os.Getenv("GDRIVE_CLIENT_SECRET"))

	if clientID == "" || clientSecret == "" {
		log.Fatal(`
❌ Faltan GDRIVE_CLIENT_ID y/o GDRIVE_CLIENT_SECRET.

Pasos para obtenerlos:
  1. Ir a https://console.cloud.google.com
  2. Crear un proyecto (o usar uno existente)
  3. Habilitar "Google Drive API" en "APIs & Services > Enabled APIs"
  4. Ir a "APIs & Services > Credentials > Create Credentials > OAuth 2.0 Client ID"
  5. Tipo de aplicación: "Desktop App"
  6. Descargar el JSON o copiar el Client ID y Client Secret

Luego ejecutá:
  GDRIVE_CLIENT_ID=tu_client_id GDRIVE_CLIENT_SECRET=tu_client_secret go run ./cmd/gdrive_auth/...
`)
	}

	cfg := &oauth2.Config{
		ClientID:     clientID,
		ClientSecret: clientSecret,
		Endpoint:     google.Endpoint,
		Scopes:       []string{drive.DriveScope},
		RedirectURL:  "urn:ietf:wg:oauth:2.0:oob", // para apps de escritorio (sin servidor web)
	}

	// 1. Generar URL de autorización
	authURL := cfg.AuthCodeURL("state", oauth2.AccessTypeOffline, oauth2.ApprovalForce)

	fmt.Println("\n" + strings.Repeat("=", 70))
	fmt.Println("  OBTENER REFRESH TOKEN DE GOOGLE DRIVE")
	fmt.Println(strings.Repeat("=", 70))
	fmt.Println("\n📌 Abrí esta URL en tu navegador con la cuenta de Google propietaria")
	fmt.Println("   de la carpeta de Drive:\n")
	fmt.Println("  " + authURL)
	fmt.Println("\n🔐 Autorizá el acceso → Google te mostrará un código.")
	fmt.Print("\n📋 Pegá el código aquí y presioná Enter: ")

	// 2. Leer el código
	reader := bufio.NewReader(os.Stdin)
	code, _ := reader.ReadString('\n')
	code = strings.TrimSpace(code)

	if code == "" {
		log.Fatal("No ingresaste ningún código.")
	}

	// 3. Intercambiar código por token
	token, err := cfg.Exchange(context.Background(), code)
	if err != nil {
		log.Fatalf("❌ Error al intercambiar el código: %v\nAsegurate de usar el código correcto y que no haya expirado.", err)
	}

	if token.RefreshToken == "" {
		log.Fatal(`❌ No se obtuvo un refresh_token.
Esto pasa cuando la cuenta ya autorizó esta app antes.
Solución: revocá el acceso en https://myaccount.google.com/permissions y volvé a ejecutar.`)
	}

	// 4. Mostrar resultado
	fmt.Println("\n" + strings.Repeat("=", 70))
	fmt.Println("  ✅ ¡ÉXITO! Copiá esto a tu .env:")
	fmt.Println(strings.Repeat("=", 70))
	fmt.Printf("\nGDRIVE_REFRESH_TOKEN=%s\n\n", token.RefreshToken)
	fmt.Println("💡 Este token no vence (a menos que revoques el acceso).")
	fmt.Println(strings.Repeat("=", 70) + "\n")
}
