package handle

import (
	"net/http"

	"core/domain/service"

	"github.com/labstack/echo/v4"
)

type ShippingHandler struct {
	svc service.ShippingService
}

func NewShippingHandler(svc service.ShippingService) *ShippingHandler {
	return &ShippingHandler{svc: svc}
}

// GetTracking gets tracking status for a shipment
// GET /api/shipping/:tracking
func (h *ShippingHandler) GetTracking(c echo.Context) error {
	tracking := c.Param("tracking")
	if tracking == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "tracking number required"})
	}

	result, err := h.svc.GetTracking(c.Request().Context(), tracking)
	if err != nil {
		return c.JSON(http.StatusNotFound, map[string]string{"error": "could not retrieve tracking for this package"})
	}

	return c.JSON(http.StatusOK, result)
}
