package handle

import (
	"net/http"
	"strconv"

	"core/api/dto"
	"core/domain/model"
	"core/domain/service"

	"github.com/labstack/echo/v4"
)

type SellerHandler struct {
	sellerService service.SellerService
}

func NewSellerHandler(s service.SellerService) *SellerHandler {
	return &SellerHandler{sellerService: s}
}

func (h *SellerHandler) GetAll(c echo.Context) error {
	ctx := c.Request().Context()
	sellers, err := h.sellerService.GetAll(ctx)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, dto.ErrorGeneral{Message: "Error al traer vendedores"})
	}

	var responses []dto.SellerResponse
	for _, s := range sellers {
		responses = append(responses, dto.SellerResponse{
			ID:                 s.ID,
			FirstName:          s.FirstName,
			LastName:           s.LastName,
			Email:              s.Email,
			Phone:              s.Phone,
			CouponCode:         s.CouponCode,
			DiscountPercentage: s.DiscountPercentage,
			IsActive:           s.IsActive,
		})
	}
	return c.JSON(http.StatusOK, responses)
}

func (h *SellerHandler) Create(c echo.Context) error {
	ctx := c.Request().Context()
	var req dto.CreateSellerRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, dto.ErrorGeneral{Message: "Datos inválidos"})
	}

	seller := &model.Seller{
		FirstName:          req.FirstName,
		LastName:           req.LastName,
		Email:              req.Email,
		Phone:              req.Phone,
		CouponCode:         req.CouponCode,
		DiscountPercentage: req.DiscountPercentage,
	}

	if err := h.sellerService.Create(ctx, seller); err != nil {
		return c.JSON(http.StatusInternalServerError, dto.ErrorGeneral{Message: "Error al crear el vendedor (¿Cupón repetido?)"})
	}

	return c.JSON(http.StatusCreated, dto.ErrorGeneral{Message: "Vendedor creado con éxito"})
}

func (h *SellerHandler) Update(c echo.Context) error {
	ctx := c.Request().Context()
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		return c.JSON(http.StatusBadRequest, dto.ErrorGeneral{Message: "ID inválido"})
	}

	var req dto.UpdateSellerRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, dto.ErrorGeneral{Message: "Datos inválidos"})
	}

	seller := &model.Seller{
		ID:                 id,
		FirstName:          req.FirstName,
		LastName:           req.LastName,
		Email:              req.Email,
		Phone:              req.Phone,
		CouponCode:         req.CouponCode,
		DiscountPercentage: req.DiscountPercentage,
		IsActive:           req.IsActive,
	}

	if err := h.sellerService.Update(ctx, seller); err != nil {
		return c.JSON(http.StatusInternalServerError, dto.ErrorGeneral{Message: "Error al actualizar el vendedor"})
	}

	return c.JSON(http.StatusOK, dto.ErrorGeneral{Message: "Vendedor actualizado"})
}