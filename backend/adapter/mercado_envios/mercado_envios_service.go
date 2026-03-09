package mercadoenvios

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"

	"core/config"
	"core/domain/model"
	"core/domain/service"
)

type mercadoEnviosService struct {
	config     config.MercadoPagoConfig
	httpClient *http.Client
}

func NewMercadoEnviosService(cfg config.MercadoPagoConfig) service.ShippingService {
	return &mercadoEnviosService{
		config: cfg,
		httpClient: &http.Client{
			Timeout: 10 * time.Second,
		},
	}
}

// Estructuras de respuesta para Mercado Libre Shipment API limitadas a lo necesario
type mlShipmentResponse struct {
	ID           int64  `json:"id"`
	Status       string `json:"status"`
	Substatus    string `json:"substatus"`
	TrackingNum  string `json:"tracking_number"`
	TrackingHash string `json:"tracking_method"`
	DateCreated  string `json:"date_created"`
}

type mlShipmentHistoryResponse []struct {
	Date      string `json:"date"`
	Status    string `json:"status"`
	Substatus string `json:"substatus"`
	Location  struct {
		AddressLine string `json:"address_line"`
	} `json:"location,omitempty"`
}

func (s *mercadoEnviosService) GetTracking(ctx context.Context, trackingNumber string) (*model.ShippingTracking, error) {
	if s.config.AccessToken == "" {
		// Mock testing mode fallbacks
		return &model.ShippingTracking{
			TrackingNumber: trackingNumber,
			Status:         "pending",
			Events: []model.ShippingEvent{
				{Date: time.Now().Format(time.RFC3339), Status: "Integración Mercadopago Inactiva", Location: "Sistema"},
			},
		}, nil
	}

	// Shipment ID is passed as the "trackingNumber" argument for MELI API.
	url := fmt.Sprintf("https://api.mercadolibre.com/shipments/%s/history", trackingNumber)
	req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		return nil, err
	}

	req.Header.Set("Authorization", "Bearer "+s.config.AccessToken)

	res, err := s.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer res.Body.Close()

	if res.StatusCode == http.StatusNotFound {
		return nil, fmt.Errorf("tracking not found in Mercado Envios")
	}

	if res.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("mercado envios tracking failed with status: %d", res.StatusCode)
	}

	var history mlShipmentHistoryResponse
	if err := json.NewDecoder(res.Body).Decode(&history); err != nil {
		return nil, fmt.Errorf("failed to decode history: %v", err)
	}

	result := &model.ShippingTracking{
		TrackingNumber: trackingNumber,
		Events:         []model.ShippingEvent{},
		Status:         "pending",
	}

	// Map events
	for _, hist := range history {
		event := model.ShippingEvent{
			Date:     hist.Date,
			Status:   mapMeliStatusToHumanReason(hist.Status, hist.Substatus),
			Reason:   hist.Substatus,
			Location: hist.Location.AddressLine,
		}
		result.Events = append(result.Events, event)
	}

	if len(history) > 0 {
		last := history[0] // API devuelve más reciente primero (dependiendo de MELI history endpoints)

		est := strings.ToLower(last.Status)

		if est == "delivered" {
			result.Status = "delivered"
		} else if est == "handled_over" || est == "shipped" || est == "in_transit" {
			result.Status = "in_transit"
		} else if est == "cancelled" {
			result.Status = "cancelled"
		} else {
			result.Status = "in_transit"
		}
	}

	return result, nil
}

func mapMeliStatusToHumanReason(status, substatus string) string {
	switch status {
	case "pending":
		return "Pendiente de Despacho"
	case "ready_to_ship":
		return "Listo para enviar"
	case "shipped":
		return "En Camino"
	case "delivered":
		return "Entregado"
	case "not_delivered":
		return "No entregado"
	case "cancelled":
		return "Envío Cancelado"
	default:
		return "En tránsito"
	}
}
