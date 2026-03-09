package model

// ShippingEvent representa un evento o estado en la línea de tiempo del envío
type ShippingEvent struct {
	Date     string `json:"date"`
	Status   string `json:"status"`
	Reason   string `json:"reason,omitempty"`
	Location string `json:"location,omitempty"`
}

// ShippingTracking representa el resumen completo del estado del paquete
type ShippingTracking struct {
	TrackingNumber string          `json:"tracking_number"`
	Status         string          `json:"status"` // "pending", "in_transit", "delivered", "cancelled"
	Events         []ShippingEvent `json:"events"`
}
