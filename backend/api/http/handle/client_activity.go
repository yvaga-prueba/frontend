package handle

import (
	"context"
	"net/http"
	"strconv"

	"core/domain/service"

	"github.com/labstack/echo/v4"
)

type ClientActivityHandler struct {
	svc service.ClientActivityService
}

func NewClientActivityHandler(svc service.ClientActivityService) *ClientActivityHandler {
	return &ClientActivityHandler{svc: svc}
}

type RecordActivityRequest struct {
	EventType string `json:"event_type"`
	Path      string `json:"path"`
	Metadata  string `json:"metadata"`
}

func (h *ClientActivityHandler) Record(c echo.Context) error {
	var req RecordActivityRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid body"})
	}

	// Ejecutar en goroutine para no bloquear la request del cliente
	go func() {
		_ = h.svc.Record(context.Background(), req.EventType, req.Path, req.Metadata)
	}()

	return c.NoContent(http.StatusAccepted)
}

func (h *ClientActivityHandler) ListRecent(c echo.Context) error {
	ctx := c.Request().Context()
	limitStr := c.QueryParam("limit")
	limit := 50
	if l, err := strconv.Atoi(limitStr); err == nil && l > 0 {
		limit = l
	}

	list, err := h.svc.ListRecent(ctx, limit)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "failed to list activities"})
	}

	return c.JSON(http.StatusOK, list)
}
