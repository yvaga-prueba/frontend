package handle

import (
	"net/http"

	"core/domain/service"
	"github.com/labstack/echo/v4"
)

type SettingHandler struct {
	svc *service.SettingService
}

func NewSettingHandler(svc *service.SettingService) *SettingHandler {
	return &SettingHandler{svc: svc}
}

func (h *SettingHandler) GetMonthlyGoal(c echo.Context) error {
	val, err := h.svc.GetMonthlyGoal(c.Request().Context())
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}
	return c.JSON(http.StatusOK, map[string]string{"goal": val})
}

type updateGoalReq struct {
	Goal string `json:"goal"`
}

func (h *SettingHandler) SetMonthlyGoal(c echo.Context) error {
	var req updateGoalReq
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Petición inválida"})
	}
	
	err := h.svc.SetMonthlyGoal(c.Request().Context(), req.Goal)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}
	return c.JSON(http.StatusOK, map[string]string{"message": "Meta actualizada"})
}