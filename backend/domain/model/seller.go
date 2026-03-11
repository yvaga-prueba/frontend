package model

import "time"

type Seller struct {
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


func (s *Seller) GetFullName() string {
	return s.FirstName + " " + s.LastName
}


