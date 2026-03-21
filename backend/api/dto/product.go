package dto

import "core/domain/model"

// CreateProductRequest representa el cuerpo de la petición para crear un producto.
// No incluye campos generados por el servidor como ID, UpdatedAt, CreatedAt.
type CreateProductRequest struct {
	BarCode     int64   `json:"bar_code" example:"7501234567890" validate:"required"`
	Title       string  `json:"title" example:"Remera Básica Negra" validate:"required"`
	Description string  `json:"description" example:"Remera de algodón 100% color negro, cuello redondo" validate:"required"`
	Stock       int64   `json:"stock" example:"50" validate:"required,min=0"`
	Size        string  `json:"size" example:"M" validate:"required,oneof=S M L XL XXL"` // S,M,L,XL,XXL
	Color       string  `json:"color"`
	Category    string  `json:"category" example:"Remeras" validate:"required"`
	UnitPrice   float64 `json:"unit_price" example:"2500.00" validate:"required,min=0"`
}

// ToEntity convierte un Createmodel.ProductRequest a una entidad model.Product.
func (r *CreateProductRequest) ToEntity() *model.Product {
	return &model.Product{
		BarCode:     r.BarCode,
		Title:       r.Title,
		Description: r.Description,
		Stock:       r.Stock,
		Size:        r.Size,
		Color:       r.Color, // <--- AGREGADO PARA CREAR
		Category:    r.Category,
		UnitPrice:   r.UnitPrice,
	}
}

// Updatemodel.ProductRequest representa el cuerpo de la petición para actualizar un producto.
// Todos los campos son opcionales para permitir actualizaciones parciales.
type UpdateProductRequest struct {
	BarCode     *int64   `json:"bar_code,omitempty" example:"7501234567890"`
	Title       *string  `json:"title,omitempty" example:"Remera Básica Negra"`
	Description *string  `json:"description,omitempty" example:"Remera de algodón 100% color negro, cuello redondo"`
	Stock       *int64   `json:"stock,omitempty" example:"50"`
	Size        *string  `json:"size,omitempty" example:"M"` // S,M,L,XL,XXL
	Color       *string  `json:"color"`
	Category    *string  `json:"category,omitempty" example:"Remeras"`
	UnitPrice   *float64 `json:"unit_price,omitempty" example:"2500.00"`
}

// ApplyToEntity aplica los campos no nulos del DTO a una entidad model.Product existente.
func (r *UpdateProductRequest) ApplyToEntity(p *model.Product) {
	if r.BarCode != nil {
		p.BarCode = *r.BarCode
	}
	if r.Title != nil {
		p.Title = *r.Title
	}
	if r.Description != nil {
		p.Description = *r.Description
	}
	if r.Stock != nil {
		p.Stock = *r.Stock
	}
	if r.Size != nil {
		p.Size = *r.Size
	}
	if r.Color != nil {
		p.Color = *r.Color 
	}
	if r.Category != nil {
		p.Category = *r.Category
	}
	if r.UnitPrice != nil {
		p.UnitPrice = *r.UnitPrice
	}
}

// model.ProductResponse representa la estructura de un producto en las respuestas de la API.
type ProductResponse struct {
	ID          int64   `json:"id" example:"1"`
	BarCode     int64   `json:"bar_code" example:"7501234567890"`
	Title       string  `json:"title" example:"Remera Básica Negra"`
	Description string  `json:"description" example:"Remera de algodón 100% color negro, cuello redondo"`
	Stock       int64   `json:"stock" example:"50"`
	Size        string  `json:"size" example:"M"`
	Color       string  `json:"color" example:"Negro"` // <--- AGREGADO PARA MANDAR AL FRONTEND
	Category    string  `json:"category" example:"Remeras"`
	UnitPrice   float64 `json:"unit_price" example:"2500.00"`
	ImageURL    string  `json:"image_url,omitempty"` // URL de la imagen primaria (Google Drive)
}

// FromEntity convierte una entidad model.Product a un model.ProductResponse.
func FromEntity(p model.Product) ProductResponse {
	return ProductResponse{
		ID:          p.ID,
		BarCode:     p.BarCode,
		Title:       p.Title,
		Description: p.Description,
		Stock:       p.Stock,
		Size:        p.Size,
		Color:       p.Color, // <--- AGREGADO PARA MANDAR AL FRONTEND
		Category:    p.Category,
		UnitPrice:   p.UnitPrice,
	}
}

// FromEntityWithImage es igual a FromEntity pero incluye la URL de imagen primaria.
func FromEntityWithImage(p model.Product, imageURL string) ProductResponse {
	r := FromEntity(p)
	r.ImageURL = imageURL
	return r
}