package dto

import "time"

type SellerResponse struct {
	ID                 int64     `json:"id"`
	FirstName          string    `json:"first_name"`
	LastName           string    `json:"last_name"`
	Email              string    `json:"email"`
	Phone              string    `json:"phone"`
	CouponCode         string    `json:"coupon_code"`
	DiscountPercentage float64   `json:"discount_percentage"`
	IsActive           bool      `json:"is_active"`
	CreatedAt          time.Time `json:"created_at"`
	UpdatedAt          time.Time `json:"updated_at"`
}

type CreateSellerRequest struct {
	FirstName          string  `json:"first_name"`
	LastName           string  `json:"last_name"`
	Email              string  `json:"email"`
	Phone              string  `json:"phone"`
	CouponCode         string  `json:"coupon_code"`
	DiscountPercentage float64 `json:"discount_percentage"`
}

type UpdateSellerRequest struct {
	FirstName          string  `json:"first_name"`
	LastName           string  `json:"last_name"`
	Email              string  `json:"email"`
	Phone              string  `json:"phone"`
	CouponCode         string  `json:"coupon_code"`
	DiscountPercentage float64 `json:"discount_percentage"`
	IsActive           bool    `json:"is_active"`
}