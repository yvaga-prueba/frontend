package handle

import (
	"fmt"
	"net/http"
	"path/filepath"
	"strconv"

	"core/api/dto"
	"core/domain/model"
	"core/domain/repo"
	"core/domain/service"

	"github.com/labstack/echo/v4"
)

type ProductImageHandler struct {
	productRepo      repo.ProductRepository
	ProductImageRepo repo.ProductImageRepository
	storage          service.StorageService
}

func NewProductImageHandler(
	productRepo repo.ProductRepository,
	productImageRepo repo.ProductImageRepository,
	storage service.StorageService,
) *ProductImageHandler {
	return &ProductImageHandler{
		productRepo:      productRepo,
		ProductImageRepo: productImageRepo,
		storage:          storage,
	}
}

// UploadImage godoc
// @Summary      Upload an image for a product
// @Description  Upload an image file for a specific product. The file is stored in Google Drive and the public URL is saved.
// @Tags         product_image
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

	// 6. Determinar MIME type
	mimeType := file.Header.Get("Content-Type")
	if mimeType == "" {
		mimeType = "application/octet-stream"
	}

	// 7. Abrir el archivo
	src, err := file.Open()
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "failed to open file"})
	}
	defer src.Close()

	// 8. Generar nombre único para el archivo en Drive
	filename := fmt.Sprintf("product_%d_%s", productID, file.Filename)

	// 9. Subir a Google Drive
	publicURL, driveFileID, err := h.storage.Upload(ctx, filename, src, mimeType)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "failed to upload image: " + err.Error()})
	}

	// 10. Guardar en BD
	productImage := &model.ProductImage{
		ProductID:   productID,
		URL:         publicURL,
		DriveFileID: driveFileID,
		IsPrimary:   req.IsPrimary,
		Position:    req.Position,
	}

	if err := h.ProductImageRepo.Create(ctx, productImage); err != nil {
		// Intentar borrar el archivo de Drive si falla la BD
		_ = h.storage.Delete(ctx, driveFileID)
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "failed to save image metadata"})
	}

	// 10.5. Compartir con las demás variantes del producto (mismo título)
	baseProduct, err := h.productRepo.GetByID(ctx, productID)
	if err == nil && baseProduct != nil {
		if variants, err := h.productRepo.GetVariantsByTitle(ctx, baseProduct.Title); err == nil {
			for _, variant := range variants {
				if variant.ID != productID { // No duplicar en el producto base
					variantImage := &model.ProductImage{
						ProductID:   variant.ID,
						URL:         publicURL,
						DriveFileID: driveFileID,
						IsPrimary:   req.IsPrimary,
						Position:    req.Position,
					}
					_ = h.ProductImageRepo.Create(ctx, variantImage)
				}
			}
		}
	}

	// 11. Respuesta
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
// @Tags         product_image
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

	images, err := h.ProductImageRepo.FindByProductID(ctx, productID)
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
// @Description  Delete a specific product image by ID. Also removes the file from Google Drive.
// @Tags         product_image
// @Produce      json
// @Param        id path int true "Product ID"
// @Param        imageId path int true "Image ID"
// @Success      204
// @Failure      400 {object} map[string]string
// @Failure      404 {object} map[string]string
// @Failure      500 {object} map[string]string
// @Security     BearerAuth
// @Router       /api/products/{id}/images/{imageId} [delete]
func (h *ProductImageHandler) DeleteImage(c echo.Context) error {
	ctx := c.Request().Context()

	imageID, err := strconv.ParseInt(c.Param("imageId"), 10, 64)
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid image id"})
	}

	// Buscar la imagen para obtener el drive_file_id y eliminarlo de Drive
	img, err := h.ProductImageRepo.FindByID(ctx, imageID)
	if err != nil {
		return c.JSON(http.StatusNotFound, map[string]string{"error": "image not found"})
	}

	// Eliminar de Google Drive (si tiene ID)
	if img.DriveFileID != "" {
		if err := h.storage.Delete(ctx, img.DriveFileID); err != nil {
			// Log del error pero no bloqueamos la eliminación de la BD
			c.Logger().Errorf("failed to delete file from Google Drive (id=%s): %v", img.DriveFileID, err)
		}
	}

	// Eliminar de la BD
	if img.DriveFileID != "" {
		if err := h.ProductImageRepo.DeleteByDriveFileID(ctx, img.DriveFileID); err != nil {
			return c.JSON(http.StatusInternalServerError, map[string]string{"error": "failed to delete image from db"})
		}
	} else {
		if err := h.ProductImageRepo.Delete(ctx, imageID); err != nil {
			return c.JSON(http.StatusInternalServerError, map[string]string{"error": "failed to delete image"})
		}
	}

	return c.NoContent(http.StatusNoContent)
}

// ProxyImage godoc
// @Summary      Get image content
// @Description  Proxy the image content directly from the storage provider (e.g. Google Drive) to bypass hotlink protections.
// @Tags         images
// @Produce      image/jpeg,image/png,image/webp,image/gif
// @Param        fileId path string true "Storage File ID"
// @Success      200 {file} file
// @Failure      404 {object} map[string]string
// @Router       /api/images/{fileId} [get]
func (h *ProductImageHandler) ProxyImage(c echo.Context) error {
	ctx := c.Request().Context()
	fileID := c.Param("fileId")

	if fileID == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "fileId is required"})
	}

	body, mimeType, err := h.storage.GetFile(ctx, fileID)
	if err != nil {
		c.Logger().Errorf("failed to proxy image %s: %v", fileID, err)
		return c.JSON(http.StatusNotFound, map[string]string{"error": "image not found or not accessible"})
	}
	defer body.Close()

	// Configurar caché agresivo, 1 año (las imágenes no cambian de contenido para un mismo fileID en Drive)
	c.Response().Header().Set("Cache-Control", "public, max-age=31536000")
	return c.Stream(http.StatusOK, mimeType, body)
}

// UpdateImageOrder godoc
// @Summary      Update product images order
// @Description  Reorder product images. The array should contain image IDs in the desired order. The first ID will be set as primary.
// @Tags         product_image
// @Accept       json
// @Produce      json
// @Param        id path int true "Product ID"
// @Param        image_ids body []int64 true "Ordered Image IDs"
// @Success      204 "No Content"
// @Failure      400 {object} map[string]string
// @Failure      404 {object} map[string]string
// @Failure      500 {object} map[string]string
// @Security     BearerAuth
// @Router       /api/products/{id}/images/reorder [put]
func (h *ProductImageHandler) UpdateImageOrder(c echo.Context) error {
	ctx := c.Request().Context()

	productID, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid product id"})
	}

	var req struct {
		ImageIDs []int64 `json:"image_ids"`
	}
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid request body"})
	}

	if len(req.ImageIDs) == 0 {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "image_ids array is required"})
	}

	_, err = h.productRepo.GetByID(ctx, productID)
	if err != nil {
		return c.JSON(http.StatusNotFound, map[string]string{"error": "product not found"})
	}

	if err := h.ProductImageRepo.UpdateOrder(ctx, productID, req.ImageIDs); err != nil {
		c.Logger().Errorf("failed to update image order: %v", err)
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "failed to update image order"})
	}

	return c.NoContent(http.StatusNoContent)
}
