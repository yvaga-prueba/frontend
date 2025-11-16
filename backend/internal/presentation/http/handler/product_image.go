package handler

import (
	"core/internal/domain/entity"
	"core/internal/domain/repository"
	"core/internal/presentation/dto"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"time"

	"github.com/labstack/echo/v4"
)

type ProductImageHandler struct {
	productRepo      repository.ProductRepository
	productImageRepo repository.ProductImageRepository
}

func NewProductImageHandler(productRepo repository.ProductRepository, productImageRepo repository.ProductImageRepository) *ProductImageHandler {
	return &ProductImageHandler{
		productRepo:      productRepo,
		productImageRepo: productImageRepo,
	}
}

// UploadImage godoc
// @Summary      Upload an image for a product
// @Description  Upload an image file for a specific product
// @Tags         products
// @Accept       multipart/form-data
// @Produce      json
// @Param        id path int true "Product ID"
// @Param        file formData file true "Image file"
// @Param        is_primary formData bool false "Is primary image"
// @Param        position formData int false "Image position"
// @Success      201 {object} dto.ProductImageResponse
// @Failure      400 {object} map[string]string
// @Failure      404 {object} map[string]string
// @Failure      500 {object} map[string]string
// @Security     BearerAuth
// @Router       /api/products/{id}/images [post]
func (h *ProductImageHandler) UploadImage(c echo.Context) error {
	ctx := c.Request().Context()

	// 1. Parsear product ID
	productID, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid product id"})
	}

	// 2. Verificar que el producto existe
	_, err = h.productRepo.GetByID(ctx, productID)
	if err != nil {
		return c.JSON(http.StatusNotFound, map[string]string{"error": "product not found"})
	}

	// 3. Parsear form data
	var req dto.UploadImageRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid form data"})
	}

	// 4. Obtener archivo
	file, err := c.FormFile("file")
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "file is required"})
	}

	// 5. Validar extensión
	ext := filepath.Ext(file.Filename)
	allowedExts := map[string]bool{".jpg": true, ".jpeg": true, ".png": true, ".gif": true, ".webp": true}
	if !allowedExts[ext] {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid file type. Allowed: jpg, jpeg, png, gif, webp"})
	}

	// 6. Crear directorio si no existe
	uploadDir := fmt.Sprintf("static/products/%d", productID)
	if err := os.MkdirAll(uploadDir, os.ModePerm); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "failed to create upload directory"})
	}

	// 7. Generar nombre único
	filename := fmt.Sprintf("%d%s", time.Now().UnixNano(), ext)
	filePath := filepath.Join(uploadDir, filename)

	// 8. Guardar archivo
	src, err := file.Open()
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "failed to open file"})
	}
	defer src.Close()

	dst, err := os.Create(filePath)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "failed to save file"})
	}
	defer dst.Close()

	if _, err = io.Copy(dst, src); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "failed to copy file"})
	}

	// 9. Guardar en BD
	imageURL := fmt.Sprintf("/%s", filePath) // "/static/products/1/123456789.jpg"
	productImage := &entity.ProductImage{
		ProductID: productID,
		URL:       imageURL,
		IsPrimary: req.IsPrimary,
		Position:  req.Position,
	}

	if err := h.productImageRepo.Create(ctx, productImage); err != nil {
		// Intentar borrar el archivo si falla la BD
		os.Remove(filePath)
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "failed to save image metadata"})
	}

	// 10. Respuesta
	response := dto.ProductImageResponse{
		ID:        productImage.ID,
		ProductID: productImage.ProductID,
		URL:       productImage.URL,
		IsPrimary: productImage.IsPrimary,
		Position:  productImage.Position,
		CreatedAt: productImage.CreatedAt,
	}

	return c.JSON(http.StatusCreated, response)
}

// GetProductImages godoc
// @Summary      Get all images for a product
// @Description  Get all images associated with a product
// @Tags         products
// @Produce      json
// @Param        id path int true "Product ID"
// @Success      200 {array} dto.ProductImageResponse
// @Failure      400 {object} map[string]string
// @Failure      500 {object} map[string]string
// @Router       /api/products/{id}/images [get]
func (h *ProductImageHandler) GetProductImages(c echo.Context) error {
	ctx := c.Request().Context()

	productID, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid product id"})
	}

	images, err := h.productImageRepo.FindByProductID(ctx, productID)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "failed to fetch images"})
	}

	var response []dto.ProductImageResponse
	for _, img := range images {
		response = append(response, dto.ProductImageResponse{
			ID:        img.ID,
			ProductID: img.ProductID,
			URL:       img.URL,
			IsPrimary: img.IsPrimary,
			Position:  img.Position,
			CreatedAt: img.CreatedAt,
		})
	}

	return c.JSON(http.StatusOK, response)
}

// DeleteImage godoc
// @Summary      Delete a product image
// @Description  Delete a specific product image by ID
// @Tags         products
// @Produce      json
// @Param        id path int true "Product ID"
// @Param        imageId path int true "Image ID"
// @Success      204
// @Failure      400 {object} map[string]string
// @Failure      500 {object} map[string]string
// @Security     BearerAuth
// @Router       /api/products/{id}/images/{imageId} [delete]
func (h *ProductImageHandler) DeleteImage(c echo.Context) error {
	ctx := c.Request().Context()

	imageID, err := strconv.ParseInt(c.Param("imageId"), 10, 64)
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid image id"})
	}

	// Opcional: buscar la imagen para borrar el archivo físico
	// (requiere agregar FindByID al repo)

	if err := h.productImageRepo.Delete(ctx, imageID); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "failed to delete image"})
	}

	return c.NoContent(http.StatusNoContent)
}
