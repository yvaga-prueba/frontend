package handle

import (
	"net/http"
	"strconv"
	"core/api/dto"
	"core/domain/repo"
	"core/domain/service"
	"core/pkg/jwtutil"

	"github.com/labstack/echo/v4"
)

type FavoriteHandler struct {
	Svc       service.FavoriteService
	ImageRepo repo.ProductImageRepository
}

func NewFavoriteHandler(s service.FavoriteService, imgRepo repo.ProductImageRepository) *FavoriteHandler {
	return &FavoriteHandler{Svc: s, ImageRepo: imgRepo}
}

func (h *FavoriteHandler) Toggle(c echo.Context) error {
	userID := jwtutil.GetUserIDFromContext(c)
	if userID == 0 { return c.JSON(http.StatusUnauthorized, map[string]string{"error": "unauthorized"}) }

	productID, err := strconv.ParseInt(c.Param("productId"), 10, 64)
	if err != nil { return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid product id"}) }

	isFav, err := h.Svc.ToggleFavorite(c.Request().Context(), userID, productID)
	if err != nil { return c.JSON(http.StatusInternalServerError, map[string]string{"error": "internal error"}) }

	return c.JSON(http.StatusOK, map[string]bool{"is_favorite": isFav})
}

func (h *FavoriteHandler) GetMyFavorites(c echo.Context) error {
	userID := jwtutil.GetUserIDFromContext(c)
	if userID == 0 { return c.JSON(http.StatusUnauthorized, map[string]string{"error": "unauthorized"}) }

	products, err := h.Svc.GetUserFavorites(c.Request().Context(), userID)
	if err != nil { return c.JSON(http.StatusInternalServerError, map[string]string{"error": "internal error"}) }

	var response []dto.ProductResponse
	for _, p := range products {
		imageURL := ""
		if h.ImageRepo != nil {
			if imgs, err := h.ImageRepo.FindByProductID(c.Request().Context(), p.ID); err == nil && len(imgs) > 0 {
				imageURL = imgs[0].URL // Simplificado, toma la primera
			}
		}
		response = append(response, dto.FromEntityWithImage(p, imageURL))
	}
	
	if response == nil {
		response = []dto.ProductResponse{} // Para que devuelva [] en vez de null si está vacío
	}

	return c.JSON(http.StatusOK, response)
}