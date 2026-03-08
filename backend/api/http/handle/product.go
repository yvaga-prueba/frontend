package handle

import (
	"net/http"
	"strconv"

	"core/api/dto"
	errorcode "core/api/error_code"
	"core/domain/repo"
	"core/domain/service"

	"github.com/labstack/echo/v4"
)

type ProductHandler struct {
	Svc       service.ProductService
	ImageRepo repo.ProductImageRepository // para obtener imagen primaria
}

func NewProductHandler(s service.ProductService, imageRepo repo.ProductImageRepository) *ProductHandler {
	return &ProductHandler{Svc: s, ImageRepo: imageRepo}
}

// List godoc
// @Summary      Listar productos
// @Description  Filtra por categoría, talla, query, limit y offset
// @Tags         products
// @Produce      json
// @Param        category query string false "Categoría"
// @Param        size     query string false "Talla (S,M,L,XL,XXL)"
// @Param        q        query string false "Búsqueda en título/desc"
// @Param        limit    query int    false "Límite (<=100)"
// @Param        offset   query int    false "Offset"
// @Success      200 {object} map[string]interface{}
// @Router       /api/products [get]
func (h *ProductHandler) List(c echo.Context) error {
	cursor := c.QueryParam("cursor")
	num := int64(20)
	if n := c.QueryParam("num"); n != "" {
		if parsed, err := strconv.ParseInt(n, 10, 64); err == nil && parsed > 0 {
			num = parsed
		}
	}

	ps, nextCursor, err := h.Svc.List(c.Request().Context(), cursor, num)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "internal error"})
	}

	var productResponses []dto.ProductResponse
	for _, p := range ps {
		imageURL := ""
		if h.ImageRepo != nil {
			if imgs, err := h.ImageRepo.FindByProductID(c.Request().Context(), p.ID); err == nil {
				for _, img := range imgs {
					if img.IsPrimary {
						imageURL = img.URL
						break
					}
				}
				// Si ninguna es primaria, usar la primera
				if imageURL == "" && len(imgs) > 0 {
					imageURL = imgs[0].URL
				}
			}
		}
		productResponses = append(productResponses, dto.FromEntityWithImage(p, imageURL))
	}

	response := map[string]interface{}{
		"products":    productResponses,
		"next_cursor": nextCursor,
	}

	return c.JSON(http.StatusOK, response)
}

// Create godoc
// @Summary      Crear producto
// @Description  Crea un nuevo producto (solo admin)
// @Tags         products
// @Accept       json
// @Produce      json
// @Param        product  body      dto.CreateProductRequest  true  "Product data"
// @Success      201      {object}  dto.ProductResponse
// @Failure      400      {object}  dto.ErrorGeneral
// @Failure      500      {object}  dto.ErrorGeneral
// @Security     BearerAuth
// @Router       /api/products [post]
func (h *ProductHandler) Create(c echo.Context) error {
	var req dto.CreateProductRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid request body"})
	}

	productEntity := req.ToEntity()
	createdProduct, err := h.Svc.Create(c.Request().Context(), productEntity)
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": err.Error()})
	}

	return c.JSON(http.StatusCreated, dto.FromEntity(*createdProduct))
}

// GetByID godoc
// @Summary      Obtener producto por ID
// @Description  Obtiene un producto específico por su ID
// @Tags         products
// @Produce      json
// @Param        id   path      int  true  "Product ID"
// @Success      200  {object}  dto.ProductResponse
// @Failure      400  {object}  map[string]string
// @Failure      404  {object}  map[string]string
// @Router       /api/products/{id} [get]
func (h *ProductHandler) GetByID(c echo.Context) error {
	idStr := c.Param("id")
	id, err := strconv.ParseInt(idStr, 10, 64)
	if err != nil || id <= 0 {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid id"})
	}

	p, err := h.Svc.GetByID(c.Request().Context(), id)
	if err != nil {
		if err == errorcode.ErrNotFound {
			return c.JSON(http.StatusNotFound, map[string]string{"error": "product not found"})
		}
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "internal error"})
	}

	// Obtener imagen primaria
	imageURL := ""
	if h.ImageRepo != nil {
		if imgs, err := h.ImageRepo.FindByProductID(c.Request().Context(), p.ID); err == nil {
			for _, img := range imgs {
				if img.IsPrimary {
					imageURL = img.URL
					break
				}
			}
			if imageURL == "" && len(imgs) > 0 {
				imageURL = imgs[0].URL
			}
		}
	}

	return c.JSON(http.StatusOK, dto.FromEntityWithImage(*p, imageURL))
}

// Update godoc
// @Summary      Actualizar producto
// @Description  Actualiza un producto existente por ID
// @Tags         products
// @Accept       json
// @Produce      json
// @Param        id       path      int                       true  "Product ID"
// @Param        product  body      dto.UpdateProductRequest  true  "Product data"
// @Success      200      {object}  dto.ProductResponse
// @Failure      400      {object}  map[string]string
// @Failure      404      {object}  map[string]string
// @Failure      500      {object}  map[string]string
// @Security     BearerAuth
// @Router       /api/products/{id} [put]
func (h *ProductHandler) Update(c echo.Context) error {
	idStr := c.Param("id")
	id, err := strconv.ParseInt(idStr, 10, 64)
	if err != nil || id <= 0 {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid id"})
	}

	var req dto.UpdateProductRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid request body"})
	}

	productEntity, err := h.Svc.GetByID(c.Request().Context(), id)
	if err != nil {
		if err == errorcode.ErrNotFound {
			return c.JSON(http.StatusNotFound, map[string]string{"error": "product not found"})
		}
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	req.ApplyToEntity(productEntity)

	updated, err := h.Svc.Update(c.Request().Context(), productEntity)
	if err != nil {
		if err == errorcode.ErrNotFound {
			return c.JSON(http.StatusNotFound, map[string]string{"error": "product not found"})
		}
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	return c.JSON(http.StatusOK, dto.FromEntity(*updated))
}

// Delete godoc
// @Summary      Eliminar producto
// @Description  Elimina un producto por ID
// @Tags         products
// @Produce      json
// @Param        id   path      int  true  "Product ID"
// @Success      204  "No Content"
// @Failure      400  {object}  dto.ErrorGeneral
// @Failure      404  {object}  dto.ErrorGeneral
// @Failure      500  {object}  dto.ErrorGeneral
// @Security     BearerAuth
// @Router       /api/products/{id} [delete]
func (h *ProductHandler) Delete(c echo.Context) error {
	idStr := c.Param("id")
	id, err := strconv.ParseInt(idStr, 10, 64)
	if err != nil || id <= 0 {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid id"})
	}

	if err := h.Svc.Delete(c.Request().Context(), id); err != nil {
		if err == errorcode.ErrNotFound {
			return c.JSON(http.StatusNotFound, map[string]string{"error": "product not found"})
		}
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	return c.NoContent(http.StatusNoContent)
}

// GetVariants godoc
// @Summary      Get variants
// @Description  Get all product variants (same title) for a given product ID
// @Tags         products
// @Produce      json
// @Param        id   path      int  true  "Product ID"
// @Success      200  {object}  []dto.ProductResponse
// @Failure      400  {object}  map[string]string
// @Failure      404  {object}  map[string]string
// @Router       /api/products/{id}/variants [get]
func (h *ProductHandler) GetVariants(c echo.Context) error {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid id format"})
	}

	// 1. Obtener el producto base para saber su título
	baseProduct, err := h.Svc.GetByID(c.Request().Context(), id)
	if err != nil {
		if err == errorcode.ErrNotFound {
			return c.JSON(http.StatusNotFound, map[string]string{"error": "product not found"})
		}
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "internal error"})
	}

	// 2. Buscar todas las variantes (mismo título)
	variants, err := h.Svc.GetVariantsByTitle(c.Request().Context(), baseProduct.Title)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "failed to get variants"})
	}

	// 3. Formatear la respuesta con su imagen principal si existe
	var productResponses []dto.ProductResponse
	for _, p := range variants {
		imageURL := ""
		if h.ImageRepo != nil {
			if imgs, err := h.ImageRepo.FindByProductID(c.Request().Context(), p.ID); err == nil {
				for _, img := range imgs {
					if img.IsPrimary {
						imageURL = img.URL
						break
					}
				}
				if imageURL == "" && len(imgs) > 0 {
					imageURL = imgs[0].URL
				}
			}
		}
		productResponses = append(productResponses, dto.FromEntityWithImage(p, imageURL))
	}

	return c.JSON(http.StatusOK, productResponses)
}

// AddStock godoc
// @Summary      Agregar stock a un producto
// @Description  Incrementa el stock de un producto existente (solo admin)
// @Tags         products
// @Accept       json
// @Produce      json
// @Param        id       path      int  true  "Product ID"
// @Param        body     body      map[string]int  true  "quantity to add"
// @Success      200      {object}  dto.ProductResponse
// @Failure      400      {object}  map[string]string
// @Failure      404      {object}  map[string]string
// @Security     BearerAuth
// @Router       /api/products/{id}/add-stock [post]
func (h *ProductHandler) AddStock(c echo.Context) error {
	idStr := c.Param("id")
	id, err := strconv.ParseInt(idStr, 10, 64)
	if err != nil || id <= 0 {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid id"})
	}

	var body struct {
		Quantity int64 `json:"quantity"`
	}
	if err := c.Bind(&body); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid request body"})
	}
	if body.Quantity <= 0 {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "quantity must be positive"})
	}

	updated, err := h.Svc.AddStock(c.Request().Context(), id, body.Quantity)
	if err != nil {
		if err == errorcode.ErrNotFound {
			return c.JSON(http.StatusNotFound, map[string]string{"error": "product not found"})
		}
		return c.JSON(http.StatusBadRequest, map[string]string{"error": err.Error()})
	}

	return c.JSON(http.StatusOK, dto.FromEntity(*updated))
}
