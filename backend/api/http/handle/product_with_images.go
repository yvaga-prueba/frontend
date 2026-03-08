package handle

import (
	"fmt"
	"net/http"
	"path/filepath"

	"core/api/dto"
	"core/domain/model"

	"github.com/labstack/echo/v4"
)

// Facade que usa los handlers existentes
type ProductFacadeHandler struct {
	ProductHandler      *ProductHandler
	ProductImageHandler *ProductImageHandler
}

func NewProductFacadeHandler(
	productHandler *ProductHandler,
	productImageHandler *ProductImageHandler,
) *ProductFacadeHandler {
	return &ProductFacadeHandler{
		ProductHandler:      productHandler,
		ProductImageHandler: productImageHandler,
	}
}

// CreateProductWithImages godoc
// @Summary      Crear producto + imágenes (fachada)
// @Description  Crea el producto y sube todas las imágenes a Google Drive.
// @Tags         product_with_images
// @Accept       multipart/form-data
// @Produce      json
// @Param        bar_code     formData int64    true  "Código de barras"
// @Param        title        formData string   true  "Título"
// @Param        description  formData string   true  "Descripción"
// @Param        stock        formData int64    true  "Stock"
// @Param        size         formData string   true  "Talla (S,M,L,XL,XXL)"
// @Param        category     formData string   true  "Categoría"
// @Param        unit_price   formData number   true  "Precio unitario"
// @Param        files        formData []file   false "Imágenes (enviar múltiples archivos con la misma clave 'files')"
// @Success      201          {object}  map[string]interface{}
// @Security     BearerAuth
// @Router       /api/products/combined [post]
func (h *ProductFacadeHandler) CreateProductWithImages(c echo.Context) error {
	ctx := c.Request().Context()

	// 1) Parsear datos de producto desde form-data
	var req dto.CreateProductFacadeRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid form data"})
	}

	if req.Title == "" || req.Description == "" || req.Size == "" || req.Category == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "missing product fields"})
	}

	// 2) Crear el producto
	createReq := dto.CreateProductRequest{
		BarCode:     req.BarCode,
		Title:       req.Title,
		Description: req.Description,
		Stock:       req.Stock,
		Size:        req.Size,
		Category:    req.Category,
		UnitPrice:   req.UnitPrice,
	}

	productEntity := createReq.ToEntity()
	createdProduct, err := h.ProductHandler.Svc.Create(ctx, productEntity)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "failed to create product"})
	}

	// 3) Procesar imágenes (si hay)
	form, err := c.MultipartForm()
	if err != nil {
		// sin archivos → solo producto
		return c.JSON(http.StatusCreated, map[string]interface{}{
			"product": dto.FromEntity(*createdProduct),
			"images":  []dto.ProductImageResponse{},
		})
	}

	files := form.File["files"]
	if len(files) == 0 {
		return c.JSON(http.StatusCreated, map[string]interface{}{
			"product": dto.FromEntity(*createdProduct),
			"images":  []dto.ProductImageResponse{},
		})
	}

	// Límite de cantidad de imágenes
	const maxImages = 10
	if len(files) > maxImages {
		return c.JSON(http.StatusBadRequest, map[string]string{
			"error": fmt.Sprintf("too many images, maximum %d per product", maxImages),
		})
	}

	// Límite de tamaño por archivo (5MB)
	const maxFileSize = 5 * 1024 * 1024
	for i, fh := range files {
		if fh.Size > maxFileSize {
			return c.JSON(http.StatusBadRequest, map[string]string{
				"error": fmt.Sprintf("file %d (%s) is too large (max 5MB)", i+1, fh.Filename),
			})
		}
	}

	allowedExts := map[string]bool{".jpg": true, ".jpeg": true, ".png": true, ".gif": true, ".webp": true}
	isPrimaryStrs := form.Value["is_primary"]

	var imagesResp []dto.ProductImageResponse

	for i, fh := range files {
		ext := filepath.Ext(fh.Filename)
		if !allowedExts[ext] {
			return c.JSON(http.StatusBadRequest, map[string]string{
				"error": fmt.Sprintf("file %d (%s) has invalid type. Allowed: jpg, jpeg, png, gif, webp", i+1, fh.Filename),
			})
		}

		// Regla de negocio para IsPrimary
		isPrimary := false
		if len(isPrimaryStrs) > 0 {
			if i < len(isPrimaryStrs) {
				v := isPrimaryStrs[i]
				if v == "true" || v == "1" || v == "on" {
					isPrimary = true
				}
			}
		} else if i == 0 {
			isPrimary = true
		}

		src, err := fh.Open()
		if err != nil {
			return c.JSON(http.StatusInternalServerError, map[string]string{"error": "failed to open file"})
		}
		defer src.Close()

		mimeType := fh.Header.Get("Content-Type")
		if mimeType == "" {
			mimeType = "application/octet-stream"
		}

		filename := fmt.Sprintf("product_%d_img%d%s", createdProduct.ID, i, ext)

		// Subir a Google Drive via StorageService
		publicURL, driveFileID, err := h.ProductImageHandler.storage.Upload(ctx, filename, src, mimeType)
		if err != nil {
			return c.JSON(http.StatusInternalServerError, map[string]string{
				"error": fmt.Sprintf("failed to upload image %d to Drive: %v", i+1, err),
			})
		}

		imgEntity := &model.ProductImage{
			ProductID:   createdProduct.ID,
			URL:         publicURL,
			DriveFileID: driveFileID,
			IsPrimary:   isPrimary,
			Position:    i,
		}

		if err := h.ProductImageHandler.ProductImageRepo.Create(ctx, imgEntity); err != nil {
			// Intentar borrar de Drive si falla la BD
			_ = h.ProductImageHandler.storage.Delete(ctx, driveFileID)
			return c.JSON(http.StatusInternalServerError, map[string]string{"error": "failed to save image metadata"})
		}

		imagesResp = append(imagesResp, dto.ProductImageResponse{
			ID:        imgEntity.ID,
			ProductID: imgEntity.ProductID,
			URL:       imgEntity.URL,
			IsPrimary: imgEntity.IsPrimary,
			Position:  imgEntity.Position,
			CreatedAt: imgEntity.CreatedAt,
		})
	}

	return c.JSON(http.StatusCreated, map[string]interface{}{
		"product": dto.FromEntity(*createdProduct),
		"images":  imagesResp,
	})
}
