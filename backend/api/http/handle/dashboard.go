package handle

import (
	"net/http"
	"time"

	"core/domain/service"
	"github.com/labstack/echo/v4"
)

type DashboardHandler struct {
	service service.DashboardService
}

func NewDashboardHandler(s service.DashboardService) *DashboardHandler {
	return &DashboardHandler{service: s}
}

func (h *DashboardHandler) GetStats(c echo.Context) error {
	startStr := c.QueryParam("start")
	endStr := c.QueryParam("end")

	// Por defecto, si no mandan fecha, calculamos el mes actual
	now := time.Now()
	startDate := time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, time.UTC)
	endDate := time.Date(now.Year(), now.Month(), now.Day(), 23, 59, 59, 0, time.UTC)

	// Si nos mandan fechas por la URL, las leemos
	if startStr != "" {
		if t, err := time.Parse("2006-01-02", startStr); err == nil {
			startDate = t
		}
	}
	if endStr != "" {
		if t, err := time.Parse("2006-01-02", endStr); err == nil {
			
			endDate = time.Date(t.Year(), t.Month(), t.Day(), 23, 59, 59, 0, time.UTC)
		}
	}

	stats, err := h.service.GetStats(c.Request().Context(), startDate, endDate)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"message": "Error al obtener estadísticas"})
	}

	return c.JSON(http.StatusOK, stats)
}