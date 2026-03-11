package handle

import (
	"net/http"
	"strconv"

	"core/api/dto"
	errorcode "core/api/error_code"
	"core/domain/model"
	"core/domain/repo"
	"core/domain/service"

	"github.com/golang-jwt/jwt/v5"
	"github.com/labstack/echo/v4"
)

type TicketHandler struct {
	ticketService service.TicketService
	userRepo      repo.UserRepository
}

func NewTicketHandler(ticketService service.TicketService, userRepo repo.UserRepository) *TicketHandler {
	return &TicketHandler{
		ticketService: ticketService,
		userRepo:      userRepo,
	}
}

// Create godoc
// @Summary      Create a new ticket (sale)
// @Description  Creates a new ticket with payment and reduces stock immediately
// @Tags         tickets
// @Accept       json
// @Produce      json
// @Param        ticket  body      dto.CreateTicketRequest  true  "Ticket data"
// @Success      201     {object}  dto.TicketResponse
// @Failure      400     {object}  dto.ErrorGeneral
// @Failure      500     {object}  dto.ErrorGeneral
// @Security     BearerAuth
// @Router       /api/tickets [post]
func (h *TicketHandler) Create(c echo.Context) error {
	ctx := c.Request().Context()
	
	// 1. Vemos si está logueado o es invitado (NO CORTAMOS SI ES 0)
	userID := getUserIDFromContext(c)

	var req dto.CreateTicketRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, dto.ErrorGeneral{Message: "invalid request body"})
	}

	if len(req.Items) == 0 {
		return c.JSON(http.StatusBadRequest, dto.ErrorGeneral{Message: "ticket must have at least one item"})
	}

	// 2. Lógica de Invitado vs Registrado
	clientName := req.ClientName
	clientEmail := req.ClientEmail

	if userID != 0 {
		// Si está logueado, le sobreescribimos los datos buscando en la BD
		if user, err := h.userRepo.GetByID(ctx, userID); err == nil {
			clientName = user.GetFullName()
			clientEmail = user.Email
		}
	} else {
		// Validamos que el invitado haya llenado los campos (por seguridad)
		if clientName == "" || clientEmail == "" {
			return c.JSON(http.StatusBadRequest, dto.ErrorGeneral{Message: "El nombre y el correo son obligatorios para invitados"})
		}
	}

	items := make([]service.TicketItemRequest, len(req.Items))
	for i, item := range req.Items {
		items[i] = service.TicketItemRequest{ProductID: item.ProductID, Quantity: item.Quantity}
	}

	// 3. Creamos el ticket con los datos correctos
	ticket, lines, err := h.ticketService.CreateTicket(ctx, userID, items, req.PaymentMethod, req.Notes, model.TicketStatusPaid, req.CouponCode, clientName, clientEmail)
	if err != nil {
		return c.JSON(http.StatusBadRequest, dto.ErrorGeneral{Message: err.Error()})
	}

	return c.JSON(http.StatusCreated, dto.FromTicketSummary(*ticket, lines))
}

// GetByID godoc
// @Summary      Get ticket by ID
// @Description  Retrieves a ticket with all its line items (owner or admin only)
// @Tags         tickets
// @Produce      json
// @Param        id   path      int  true  "Ticket ID"
// @Success      200  {object}  dto.TicketResponse
// @Failure      403  {object}  dto.ErrorGeneral
// @Failure      404  {object}  dto.ErrorGeneral
// @Security     BearerAuth
// @Router       /api/tickets/{id} [get]
func (h *TicketHandler) GetByID(c echo.Context) error {
	ctx := c.Request().Context()

	userID := getUserIDFromContext(c)
	userRole := getUserRoleFromContext(c)

	ticketID, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		return c.JSON(http.StatusBadRequest, dto.ErrorGeneral{Message: "invalid ticket id"})
	}

	ticket, lines, err := h.ticketService.GetTicketByID(ctx, ticketID)
	if err != nil {
		if err == errorcode.ErrNotFound {
			return c.JSON(http.StatusNotFound, dto.ErrorGeneral{Message: "ticket not found"})
		}
		return c.JSON(http.StatusInternalServerError, dto.ErrorGeneral{Message: "internal error"})
	}

	// Check if user owns this ticket or is admin
	if ticket.UserID != userID && userRole != "admin" {
		return c.JSON(http.StatusForbidden, dto.ErrorGeneral{Message: "access denied"})
	}

	return c.JSON(http.StatusOK, dto.FromTicket(*ticket, lines))
}

// GetMyTickets godoc
// @Summary      Get current user's tickets
// @Description  Retrieves all tickets for the authenticated user
// @Tags         tickets
// @Produce      json
// @Param        status query string false "Filter by status"
// @Param        limit  query int    false "Limit"
// @Param        offset query int    false "Offset"
// @Success      200    {array}  dto.TicketSummaryResponse
// @Security     BearerAuth
// @Router       /api/tickets/my [get]
func (h *TicketHandler) GetMyTickets(c echo.Context) error {
	ctx := c.Request().Context()

	userID := getUserIDFromContext(c)
	if userID == 0 {
		return c.JSON(http.StatusUnauthorized, dto.ErrorGeneral{Message: "unauthorized"})
	}

	filter := repo.TicketFilter{
		UserID: userID,
		Status: model.TicketStatus(c.QueryParam("status")),
	}

	if limit := c.QueryParam("limit"); limit != "" {
		if l, err := strconv.Atoi(limit); err == nil {
			filter.Limit = l
		}
	}

	if offset := c.QueryParam("offset"); offset != "" {
		if o, err := strconv.Atoi(offset); err == nil {
			filter.Offset = o
		}
	}

	tickets, err := h.ticketService.GetUserTickets(ctx, userID, filter)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, dto.ErrorGeneral{Message: "internal error"})
	}

	// Convert to summary responses (we don't need full line items for list)
	summaries := make([]dto.TicketSummaryResponse, len(tickets))
	for i, ticket := range tickets {
		// Traemos las prendas reales
		_, lines, _ := h.ticketService.GetTicketByID(ctx, ticket.ID)
		// Le inyectamos las prendas a la respuesta
		summaries[i] = dto.FromTicketSummary(ticket, lines)
	}

	return c.JSON(http.StatusOK, summaries)

}

// List godoc
// @Summary      List all tickets (admin only)
// @Description  Retrieves all tickets with filtering options
// @Tags         tickets
// @Produce      json
// @Param        status    query string false "Filter by status"
// @Param        user_id   query int    false "Filter by user ID"
// @Param        date_from query string false "Filter from date (YYYY-MM-DD)"
// @Param        date_to   query string false "Filter to date (YYYY-MM-DD)"
// @Param        limit     query int    false "Limit"
// @Param        offset    query int    false "Offset"
// @Success      200       {array}  dto.TicketSummaryResponse
// @Security     BearerAuth
// @Router       /api/tickets [get]
func (h *TicketHandler) List(c echo.Context) error {
	ctx := c.Request().Context()

	filter := repo.TicketFilter{
		Status:   model.TicketStatus(c.QueryParam("status")),
		DateFrom: c.QueryParam("date_from"),
		DateTo:   c.QueryParam("date_to"),
	}

	if userID := c.QueryParam("user_id"); userID != "" {
		if uid, err := strconv.ParseInt(userID, 10, 64); err == nil {
			filter.UserID = uid
		}
	}

	if limit := c.QueryParam("limit"); limit != "" {
		if l, err := strconv.Atoi(limit); err == nil {
			filter.Limit = l
		}
	}

	if offset := c.QueryParam("offset"); offset != "" {
		if o, err := strconv.Atoi(offset); err == nil {
			filter.Offset = o
		}
	}

	tickets, err := h.ticketService.ListTickets(ctx, filter)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, dto.ErrorGeneral{Message: "internal error"})
	}

	summaries := make([]dto.TicketSummaryResponse, len(tickets))
	for i, ticket := range tickets {
		// Traemos las prendas reales
		_, lines, _ := h.ticketService.GetTicketByID(ctx, ticket.ID)
		// Le inyectamos las prendas a la respuesta
		summaries[i] = dto.FromTicketSummary(ticket, lines)
	}

	return c.JSON(http.StatusOK, summaries)

	
}

// ListInvoices godoc
// @Summary      List all electronic invoices (admin only)
// @Description  Retrieves all tickets that have a CAE (AFIP invoice emitted)
// @Tags         tickets
// @Produce      json
// @Param        date_from query string false "Filter from date (YYYY-MM-DD)"
// @Param        date_to   query string false "Filter to date (YYYY-MM-DD)"
// @Param        limit     query int    false "Limit"
// @Param        offset    query int    false "Offset"
// @Success      200       {array}  dto.TicketSummaryResponse
// @Security     BearerAuth
// @Router       /api/tickets/invoices [get]
func (h *TicketHandler) ListInvoices(c echo.Context) error {
	ctx := c.Request().Context()

	// Check if user is admin
	userRole := getUserRoleFromContext(c)
	if userRole != "admin" {
		return c.JSON(http.StatusForbidden, dto.ErrorGeneral{Message: "admin access required"})
	}

	filter := repo.TicketFilter{
		DateFrom:    c.QueryParam("date_from"),
		DateTo:      c.QueryParam("date_to"),
		OnlyWithCAE: true,
	}

	if limit := c.QueryParam("limit"); limit != "" {
		if l, err := strconv.Atoi(limit); err == nil {
			filter.Limit = l
		}
	}

	if offset := c.QueryParam("offset"); offset != "" {
		if o, err := strconv.Atoi(offset); err == nil {
			filter.Offset = o
		}
	}

	tickets, err := h.ticketService.ListTickets(ctx, filter)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, dto.ErrorGeneral{Message: "internal error"})
	}

	summaries := make([]dto.TicketSummaryResponse, len(tickets))
	for i, ticket := range tickets {
		// Traemos las prendas reales
		_, lines, _ := h.ticketService.GetTicketByID(ctx, ticket.ID)
		// Le inyectamos las prendas a la respuesta
		summaries[i] = dto.FromTicketSummary(ticket, lines)
	}

	return c.JSON(http.StatusOK, summaries)
}

// Complete godoc
// @Summary      Mark ticket as completed (admin only)
// @Description  Changes ticket status from paid to completed
// @Tags         tickets
// @Produce      json
// @Param        id   path      int  true  "Ticket ID"
// @Success      200  {object}  dto.TicketResponse
// @Failure      400  {object}  dto.ErrorGeneral
// @Security     BearerAuth
// @Router       /api/tickets/{id}/complete [post]
func (h *TicketHandler) Complete(c echo.Context) error {
	ctx := c.Request().Context()

	ticketID, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		return c.JSON(http.StatusBadRequest, dto.ErrorGeneral{Message: "invalid ticket id"})
	}

	if err := h.ticketService.CompleteTicket(ctx, ticketID); err != nil {
		return c.JSON(http.StatusBadRequest, dto.ErrorGeneral{Message: err.Error()})
	}

	ticket, lines, _ := h.ticketService.GetTicketByID(ctx, ticketID)
	return c.JSON(http.StatusOK, dto.FromTicket(*ticket, lines))
}

// Cancel godoc
// @Summary      Cancel a ticket
// @Description  Cancels a ticket and restores product stock
// @Tags         tickets
// @Produce      json
// @Param        id   path      int  true  "Ticket ID"
// @Success      200  {object}  dto.TicketResponse
// @Failure      400  {object}  dto.ErrorGeneral
// @Failure      403  {object}  dto.ErrorGeneral
// @Security     BearerAuth
// @Router       /api/tickets/{id}/cancel [post]
func (h *TicketHandler) Cancel(c echo.Context) error {
	ctx := c.Request().Context()

	userID := getUserIDFromContext(c)
	userRole := getUserRoleFromContext(c)

	ticketID, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		return c.JSON(http.StatusBadRequest, dto.ErrorGeneral{Message: "invalid ticket id"})
	}

	// Get ticket to check ownership
	ticket, _, err := h.ticketService.GetTicketByID(ctx, ticketID)
	if err != nil {
		if err == errorcode.ErrNotFound {
			return c.JSON(http.StatusNotFound, dto.ErrorGeneral{Message: "ticket not found"})
		}
		return c.JSON(http.StatusInternalServerError, dto.ErrorGeneral{Message: "internal error"})
	}

	// Check if user owns this ticket or is admin
	if ticket.UserID != userID && userRole != "admin" {
		return c.JSON(http.StatusForbidden, dto.ErrorGeneral{Message: "access denied"})
	}

	if err := h.ticketService.CancelTicket(ctx, ticketID); err != nil {
		return c.JSON(http.StatusBadRequest, dto.ErrorGeneral{Message: err.Error()})
	}

	ticket, lines, _ := h.ticketService.GetTicketByID(ctx, ticketID)
	return c.JSON(http.StatusOK, dto.FromTicket(*ticket, lines))
}

// UpdateTracking godoc
// @Summary      Update tracking number (admin only)
// @Description  Updates the shipping tracking number for a ticket
// @Tags         tickets
// @Produce      json
// @Param        id   path      int  true  "Ticket ID"
// @Param        tracking body object true "Tracking info"
// @Success      200  {object}  dto.TicketResponse
// @Failure      400  {object}  dto.ErrorGeneral
// @Failure      403  {object}  dto.ErrorGeneral
// @Security     BearerAuth
// @Router       /api/tickets/{id}/tracking [put]
func (h *TicketHandler) UpdateTracking(c echo.Context) error {
	ctx := c.Request().Context()

	userRole := getUserRoleFromContext(c)
	if userRole != "admin" {
		return c.JSON(http.StatusForbidden, dto.ErrorGeneral{Message: "admin access required"})
	}

	ticketID, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		return c.JSON(http.StatusBadRequest, dto.ErrorGeneral{Message: "invalid ticket id"})
	}

	var req struct {
		TrackingNumber string `json:"tracking_number"`
	}
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, dto.ErrorGeneral{Message: "invalid request body"})
	}

	if err := h.ticketService.UpdateTrackingNumber(ctx, ticketID, req.TrackingNumber); err != nil {
		return c.JSON(http.StatusBadRequest, dto.ErrorGeneral{Message: err.Error()})
	}

	ticket, lines, _ := h.ticketService.GetTicketByID(ctx, ticketID)
	return c.JSON(http.StatusOK, dto.FromTicket(*ticket, lines))
}

// GetReceipt godoc
// @Summary      Get printable receipt
// @Description  Retrieves a formatted receipt for a ticket
// @Tags         tickets
// @Produce      json
// @Param        id   path      int  true  "Ticket ID"
// @Success      200  {object}  dto.TicketReceiptResponse
// @Failure      404  {object}  dto.ErrorGeneral
// @Router       /api/tickets/{id}/receipt [get]
func (h *TicketHandler) GetReceipt(c echo.Context) error {
	ctx := c.Request().Context()

	ticketID, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		return c.JSON(http.StatusBadRequest, dto.ErrorGeneral{Message: "invalid ticket id"})
	}

	ticket, lines, err := h.ticketService.GetTicketByID(ctx, ticketID)
	if err != nil {
		if err == errorcode.ErrNotFound {
			return c.JSON(http.StatusNotFound, dto.ErrorGeneral{Message: "ticket not found"})
		}
		return c.JSON(http.StatusInternalServerError, dto.ErrorGeneral{Message: "internal error"})
	}

	// Get user info
	user, err := h.userRepo.GetByID(ctx, ticket.UserID)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, dto.ErrorGeneral{Message: "failed to get user info"})
	}

	lineResponses := make([]dto.TicketLineResponse, len(lines))
	for i, line := range lines {
		lineResponses[i] = dto.FromTicketLine(line)
	}

	receipt := dto.TicketReceiptResponse{
		TicketNumber:  ticket.TicketNumber,
		UserName:      user.GetFullName(),
		UserEmail:     user.Email,
		Status:        ticket.Status,
		PaymentMethod: ticket.PaymentMethod,
		Lines:         lineResponses,
		Subtotal:      ticket.Subtotal,
		TaxRate:       ticket.TaxRate,
		TaxAmount:     ticket.TaxAmount,
		Total:         ticket.Total,
		Notes:         ticket.Notes,
		PaidAt:        ticket.PaidAt,
		CreatedAt:     ticket.CreatedAt,
	}

	return c.JSON(http.StatusOK, receipt)
}

// Helper functions to extract user info from JWT
func getUserIDFromContext(c echo.Context) int64 {
	user := c.Get("user")
	if user == nil {
		return 0
	}

	token, ok := user.(*jwt.Token)
	if !ok {
		return 0
	}

	claims, ok := token.Claims.(jwt.MapClaims)
	if !ok {
		return 0
	}

	userIDFloat, ok := claims["user_id"].(float64)
	if !ok {
		return 0
	}

	return int64(userIDFloat)
}

func getUserRoleFromContext(c echo.Context) string {
	user := c.Get("user")
	if user == nil {
		return ""
	}

	token, ok := user.(*jwt.Token)
	if !ok {
		return ""
	}

	claims, ok := token.Claims.(jwt.MapClaims)
	if !ok {
		return ""
	}

	role, _ := claims["role"].(string)
	return role
}
