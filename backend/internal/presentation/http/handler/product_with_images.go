package handler

import (
	"core/internal/domain/entity"
	"core/internal/presentation/dto"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"time"

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
// @Description  Crea el producto y asigna el orden de las imágenes según el orden de subida.
// @Tags         products
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
// @Failure      400          {object}  map[string]string
// @Failure      500          {object}  map[string]string
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

	// 2) Construir el DTO que ya usas para crear productos
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
		// sin archivos -> solo producto
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
	const maxFileSize = 5 * 1024 * 1024 // 5MB
	for i, fh := range files {
		if fh.Size > maxFileSize {
			return c.JSON(http.StatusBadRequest, map[string]string{
				"error": fmt.Sprintf("file %d (%s) is too large (max 5MB)", i+1, fh.Filename),
			})
		}
	}

	// Opcional: array de is_primary desde el form
	isPrimaryStrs := form.Value["is_primary"]

	var imagesResp []dto.ProductImageResponse

	uploadDir := fmt.Sprintf("static/products/%d", createdProduct.ID)
	if err := os.MkdirAll(uploadDir, os.ModePerm); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "failed to create upload directory"})
	}

	allowedExts := map[string]bool{".jpg": true, ".jpeg": true, ".png": true, ".gif": true, ".webp": true}

	for i, fh := range files {
		ext := filepath.Ext(fh.Filename)
		if !allowedExts[ext] {
			return c.JSON(http.StatusBadRequest, map[string]string{
				"error": fmt.Sprintf("file %d (%s) has invalid type. Allowed: jpg, jpeg, png, gif, webp", i+1, fh.Filename),
			})
		}

		// Regla de negocio para IsPrimary:
		// - Si hay is_primary[i], la respetamos
		// - Si no hay ninguno, la primera imagen (i == 0) es primaria
		isPrimary := false
		if len(isPrimaryStrs) > 0 {
			// hay info en el form: intentamos mapear por índice
			if i < len(isPrimaryStrs) {
				v := isPrimaryStrs[i]
				if v == "true" || v == "1" || v == "on" {
					isPrimary = true
				}
			}
		} else {
			// no vino is_primary: la primera imagen es primaria
			if i == 0 {
				isPrimary = true
			}
		}

		// La posición la definimos según el orden de subida
		position := i

		src, err := fh.Open()
		if err != nil {
			return c.JSON(http.StatusInternalServerError, map[string]string{"error": "failed to open file"})
		}
		defer src.Close()

		filename := fmt.Sprintf("%d_%d%s", time.Now().UnixNano(), i, ext)
		filePath := filepath.Join(uploadDir, filename)

		dst, err := os.Create(filePath)
		if err != nil {
			return c.JSON(http.StatusInternalServerError, map[string]string{"error": "failed to save file"})
		}

		if _, err := io.Copy(dst, src); err != nil {
			dst.Close()
			return c.JSON(http.StatusInternalServerError, map[string]string{"error": "failed to copy file"})
		}
		dst.Close()

		imgEntity := &entity.ProductImage{
			ProductID: createdProduct.ID,
			URL:       "/" + filePath,
			IsPrimary: isPrimary,
			Position:  position,
		}

		if err := h.ProductImageHandler.productImageRepo.Create(ctx, imgEntity); err != nil {
			os.Remove(filePath)
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
