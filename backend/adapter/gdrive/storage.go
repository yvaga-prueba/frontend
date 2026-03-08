package gdrive

import (
	"context"
	"fmt"
	"io"

	"golang.org/x/oauth2"
	"golang.org/x/oauth2/google"
	"google.golang.org/api/drive/v3"
	"google.golang.org/api/option"
)

// StorageAdapter implementa domain/service.StorageService usando Google Drive API v3.
// Usa OAuth2 con refresh_token para autenticarse con la cuenta personal del usuario
// (a diferencia de Service Accounts, esto SÍ usa la cuota de almacenamiento personal).
type StorageAdapter struct {
	service  *drive.Service
	folderID string
}

// New crea un StorageAdapter autenticado con OAuth2 (refresh_token).
// Se necesitan: clientID, clientSecret y refreshToken de la cuenta propietaria del Drive.
func New(ctx context.Context, clientID, clientSecret, refreshToken, folderID string) (*StorageAdapter, error) {
	cfg := &oauth2.Config{
		ClientID:     clientID,
		ClientSecret: clientSecret,
		Endpoint:     google.Endpoint,
		Scopes:       []string{drive.DriveScope},
	}

	token := &oauth2.Token{
		RefreshToken: refreshToken,
		// AccessToken vacío: oauth2 lo renovará automáticamente usando el refresh_token
	}

	tokenSource := cfg.TokenSource(ctx, token)

	svc, err := drive.NewService(ctx, option.WithTokenSource(tokenSource))
	if err != nil {
		return nil, fmt.Errorf("gdrive: failed to create drive service: %w", err)
	}

	return &StorageAdapter{
		service:  svc,
		folderID: folderID,
	}, nil
}

// Upload sube un archivo a la carpeta de Drive configurada.
// Devuelve la URL pública directa y el file ID para poder eliminarlo luego.
func (a *StorageAdapter) Upload(ctx context.Context, filename string, content io.Reader, mimeType string) (string, string, error) {
	file := &drive.File{
		Name:    filename,
		Parents: []string{a.folderID},
	}

	uploaded, err := a.service.Files.Create(file).
		Media(content).
		Fields("id, webContentLink, webViewLink").
		Context(ctx).
		Do()
	if err != nil {
		return "", "", fmt.Errorf("gdrive: failed to upload file: %w", err)
	}

	// Hacer el archivo accesible públicamente (cualquiera con el link puede verlo)
	permission := &drive.Permission{
		Type: "anyone",
		Role: "reader",
	}
	if _, err := a.service.Permissions.Create(uploaded.Id, permission).Context(ctx).Do(); err != nil {
		// Si falla el permiso, borrar el archivo y retornar error
		_ = a.service.Files.Delete(uploaded.Id).Context(ctx).Do()
		return "", "", fmt.Errorf("gdrive: failed to set public permission: %w", err)
	}

	// Generar URL pública apuntando a NUESTRO backend, como proxy para saltar rate limits.
	// El frontend consultará al backend, y este lee la imagen autenticado
	// (evitando límites de Google CDN públicos).
	publicURL := fmt.Sprintf("/api/images/%s", uploaded.Id)

	return publicURL, uploaded.Id, nil
}

// GetFile descarga y lee un archivo desde Google Drive, proxying el stream directo
func (a *StorageAdapter) GetFile(ctx context.Context, fileID string) (io.ReadCloser, string, error) {
	req := a.service.Files.Get(fileID).Context(ctx)

	// Primero obtenemos metadata para el mime type
	fileMeta, err := req.Fields("mimeType").Do()
	if err != nil {
		return nil, "", fmt.Errorf("gdrive: failed to get metadata for %s: %w", fileID, err)
	}

	// Luego iniciamos la descarga real
	res, err := req.Download()
	if err != nil {
		return nil, "", fmt.Errorf("gdrive: failed to download file %s: %w", fileID, err)
	}

	return res.Body, fileMeta.MimeType, nil
}

// Delete elimina un archivo de Drive por su ID.
func (a *StorageAdapter) Delete(ctx context.Context, fileID string) error {
	if fileID == "" {
		return nil
	}
	if err := a.service.Files.Delete(fileID).Context(ctx).Do(); err != nil {
		return fmt.Errorf("gdrive: failed to delete file %s: %w", fileID, err)
	}
	return nil
}
