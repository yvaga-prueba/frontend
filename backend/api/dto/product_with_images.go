// internal/presentation/dto/product_facade.go
package dto

type CreateProductFacadeRequest struct {
	BarCode     int64   `form:"bar_code"`
	Title       string  `form:"title"`
	Description string  `form:"description"`
	Stock       int64   `form:"stock"`
	Size        string  `form:"size"`
	Color       string  `form:"color"`
	Gender      string  `form:"gender"`
	Category    string  `form:"category"`
	UnitPrice   float64 `form:"unit_price"`

	// Metadatos por imagen
	IsPrimary []bool `form:"is_primary"`
	Position  []int  `form:"position"`
}
