package product

import (
	"core/internal/errors"
	"net/http"
	"strconv"

	"github.com/labstack/echo/v4"
)

type ProductHandler struct {
	Svc ProductService
}

func NewProductHandler(s ProductService) *ProductHandler {
	return &ProductHandler{Svc: s}
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

	var productResponses []ProductResponse
	for _, p := range ps {
		productResponses = append(productResponses, FromEntity(p))
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
// @Param        product  body      CreateProductRequest  true  "Product data"
// @Success      201      {object}  product.ProductResponse
// @Failure      400      {object}  errors.ErrorGeneral
// @Failure      500      {object}  errors.ErrorGeneral
// @Security     BearerAuth
// @Router       /api/products [post]
func (h *ProductHandler) Create(c echo.Context) error {
	var req CreateProductRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid request body"})
	}

	productEntity := req.ToEntity()
	createdProduct, err := h.Svc.Create(c.Request().Context(), productEntity)
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": err.Error()})
	}

	return c.JSON(http.StatusCreated, FromEntity(*createdProduct))
}

// GetByID godoc
// @Summary      Obtener producto por ID
// @Description  Obtiene un producto específico por su ID
// @Tags         products
// @Produce      json
// @Param        id   path      int  true  "Product ID"
// @Success      200  {object}  product.ProductResponse
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
		if err == errors.ErrNotFound {
			return c.JSON(http.StatusNotFound, map[string]string{"error": "product not found"})
		}
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "internal error"})
	}

	return c.JSON(http.StatusOK, FromEntity(*p))
}

// Update godoc
// @Summary      Actualizar producto
// @Description  Actualiza un producto existente por ID
// @Tags         products
// @Accept       json
// @Produce      json
// @Param        id       path      int                       true  "Product ID"
// @Param        product  body      UpdateProductRequest      true  "Product data"
// @Success      200      {object}  product.ProductResponse
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

	var req UpdateProductRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid request body"})
	}

	productEntity, err := h.Svc.GetByID(c.Request().Context(), id)
	if err != nil {
		if err == errors.ErrNotFound {
			return c.JSON(http.StatusNotFound, map[string]string{"error": "product not found"})
		}
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	req.ApplyToEntity(productEntity)

	updated, err := h.Svc.Update(c.Request().Context(), productEntity)
	if err != nil {
		if err == errors.ErrNotFound {
			return c.JSON(http.StatusNotFound, map[string]string{"error": "product not found"})
		}
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	return c.JSON(http.StatusOK, FromEntity(*updated))
}

// Delete godoc
// @Summary      Eliminar producto
// @Description  Elimina un producto por ID
// @Tags         products
// @Produce      json
// @Param        id   path      int  true  "Product ID"
// @Success      204  "No Content"
// @Failure      400  {object}  errors.ErrorGeneral
// @Failure      404  {object}  errors.ErrorGeneral
// @Failure      500  {object}  errors.ErrorGeneral
// @Security     BearerAuth
// @Router       /api/products/{id} [delete]
func (h *ProductHandler) Delete(c echo.Context) error {
	idStr := c.Param("id")
	id, err := strconv.ParseInt(idStr, 10, 64)
	if err != nil || id <= 0 {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid id"})
	}

	if err := h.Svc.Delete(c.Request().Context(), id); err != nil {
		if err == errors.ErrNotFound {
			return c.JSON(http.StatusNotFound, map[string]string{"error": "product not found"})
		}
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	return c.NoContent(http.StatusNoContent)
}
