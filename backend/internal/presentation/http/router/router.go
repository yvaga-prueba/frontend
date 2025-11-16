package router

import (
	"core/internal/config"
	"core/internal/presentation/http/handler"

	echojwt "github.com/labstack/echo-jwt/v4"
	"github.com/labstack/echo/v4"
	"github.com/labstack/echo/v4/middleware"
	echoSwagger "github.com/swaggo/echo-swagger"
)

func Router(
	productHandler *handler.ProductHandler,
	productImageHandler *handler.ProductImageHandler,
	authHandler *handler.AuthHandler,
	cfg config.Config,
) *echo.Echo {
	e := echo.New()

	// Middlewares globales
	e.Use(middleware.Logger())
	e.Use(middleware.Recover())
	e.Use(middleware.CORS())

	// Servir archivos estáticos
	e.Static("/static", "static")

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

	// Rutas protegidas
	protected := api.Group("")
	protected.Use(echojwt.WithConfig(echojwt.Config{
		SigningKey: []byte(cfg.JWTSecret),
		// TokenLookup: "header:Authorization",
		// AuthScheme:  "Bearer",
	}))
	// Rutas protegidas de productos
	api.POST("/products", productHandler.Create)
	api.PUT("/products/:id", productHandler.Update)
	api.DELETE("/products/:id", productHandler.Delete)

	// Rutas protegidas de imágenes
	api.POST("/products/:id/images", productImageHandler.UploadImage)
	api.DELETE("/products/:id/images/:imageId", productImageHandler.DeleteImage)

	return e
}
