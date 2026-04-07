package model

type DashboardStats struct {
	TotalSales    float64         `json:"total_sales"`
	TotalOrders   int             `json:"total_orders"`
	AverageTicket float64         `json:"average_ticket"`
	CashCount     int             `json:"cash_count"`
	CardCount     int             `json:"card_count"`
	TransferCount int             `json:"transfer_count"`
	CategoryStats []CategoryStat  `json:"category_stats"`
	BestProducts  []ProductStat   `json:"best_products"`
	BestCustomers []CustomerStat  `json:"best_customers"`
	BestSellers   []SellerStat    `json:"best_sellers"`
	DailySales    []DailySaleStat `json:"daily_sales"`
}

type CategoryStat struct {
	Category string  `json:"category"`
	Total    float64 `json:"total"`
	Quantity int     `json:"quantity"`
}

type ProductStat struct {
	Name     string  `json:"name"`
	Quantity int     `json:"quantity"`
	Total    float64 `json:"total"`
}

type CustomerStat struct {
	Name  string  `json:"name"`
	Total float64 `json:"total"`
}

type SellerStat struct {
	Name  string  `json:"name"`
	Total float64 `json:"total"`
}

type DailySaleStat struct {
	Date  string  `json:"date"`
	Total float64 `json:"total"`
}