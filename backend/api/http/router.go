package router

import (
	"core/api/http/handle"
	"core/config"
	"core/pkg/jwtutil"

	"github.com/labstack/echo/v4"
	"github.com/labstack/echo/v4/middleware"
	echoSwagger "github.com/swaggo/echo-swagger"
)

func Router(
	productHandler *handle.ProductHandler,
	productImageHandler *handle.ProductImageHandler,
	authHandler *handle.AuthHandler,
	productFacadeHandler *handle.ProductFacadeHandler,
	ticketHandler *handle.TicketHandler,
	paymentHandler *handle.PaymentHandler,
	cfg config.Config,
) *echo.Echo {
	e := echo.New()

	// Middlewares globales
	e.Use(middleware.Logger())
	e.Use(middleware.Recover())
	e.Use(middleware.CORS())

	// Servir archivos estáticos
	e.Static("/static", "static")
	e.Use(middleware.BodyLimit("50M"))

	// Swagger
	e.GET("/swagger/*", echoSwagger.WrapHandler)

	// Health check
	e.GET("/healthz", func(c echo.Context) error {
		return c.JSON(200, map[string]string{"status": "ok"})
	})

	// Rutas públicas de auth
	e.POST("/api/auth/register", authHandler.Register)
	e.POST("/api/auth/login", authHandler.Login)
	e.POST("/api/auth/google", authHandler.GoogleLogin)

	// Rutas públicas de productos (GET)
	e.GET("/api/products", productHandler.List)
	e.GET("/api/products/:id", productHandler.GetByID)
	e.GET("/api/products/:id/images", productImageHandler.GetProductImages)

	api := e.Group("/api")

	// Rutas protegidas - USAR EL MIDDLEWARE PERSONALIZADO
	protected := api.Group("")
	protected.Use(jwtutil.JWTMiddleware(&cfg))
	protected.GET("/auth/me", authHandler.Me)

	// Rutas protegidas de productos
	protected.POST("/products", productHandler.Create)
	protected.PUT("/products/:id", productHandler.Update)
	protected.DELETE("/products/:id", productHandler.Delete)
	protected.POST("/products/:id/add-stock", productHandler.AddStock)

	protected.POST("/products/combined", productFacadeHandler.CreateProductWithImages)

	// Rutas protegidas de imágenes
	protected.POST("/products/:id/images", productImageHandler.UploadImage)
	protected.DELETE("/products/:id/images/:imageId", productImageHandler.DeleteImage)

	// Rutas públicas de tickets (receipt)
	e.GET("/api/tickets/:id/receipt", ticketHandler.GetReceipt)

	// Rutas protegidas de tickets
	protected.POST("/tickets", ticketHandler.Create)
	protected.GET("/tickets/my", ticketHandler.GetMyTickets)
	protected.GET("/tickets/:id", ticketHandler.GetByID)
	protected.POST("/tickets/:id/cancel", ticketHandler.Cancel)

	// Rutas admin de tickets
	protected.GET("/tickets", ticketHandler.List)                   // Admin only (check in handler)
	protected.GET("/tickets/invoices", ticketHandler.ListInvoices)  // Admin only
	protected.POST("/tickets/:id/complete", ticketHandler.Complete) // Admin only

	// Rutas de pagos (MercadoPago + transferencia)
	// El webhook es PÚBLICO — MP lo llama sin JWT
	e.POST("/api/payments/webhook", paymentHandler.MPWebhook)
	// La preferencia requiere JWT (usuario autenticado)
	protected.POST("/payments/preference", paymentHandler.CreatePreference)

	return e
}
