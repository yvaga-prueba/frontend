package service

import (
	"context"
	"io"
)

// StorageService define la interfaz para subir y eliminar archivos.
// Permite intercambiar el provider (local, Google Drive, S3, etc.) sin tocar los handlers.
type StorageService interface {
	// Upload sube un archivo y devuelve la URL pública para accederlo.
	Upload(ctx context.Context, filename string, content io.Reader, mimeType string) (publicURL string, fileID string, err error)

	// Delete elimina un archivo por su ID en el provider.
	Delete(ctx context.Context, fileID string) error

	// GetFile descarga y lee un archivo por su ID, retornando también el MIME type.
	GetFile(ctx context.Context, fileID string) (io.ReadCloser, string, error)
}
