package entity

import (
	"context"
	"database/sql"
	"log"
	"time"

	"core/domain/model"
	"core/domain/repo"
)

type DashboardRepo struct {
	DB *sql.DB
}

func NewDashboardRepository(db *sql.DB) repo.DashboardRepository {
	return &DashboardRepo{DB: db}
}

func (r *DashboardRepo) GetStats(ctx context.Context, startDate time.Time, endDate time.Time) (*model.DashboardStats, error) {
	// Aseguramos que Angular reciba listas vacías en vez de null si no hay datos
	stats := &model.DashboardStats{
		CategoryStats: make([]model.CategoryStat, 0),
		BestProducts:  make([]model.ProductStat, 0),
		BestCustomers: make([]model.CustomerStat, 0),
		BestSellers:   make([]model.SellerStat, 0),
		DailySales:    make([]model.DailySaleStat, 0),
	}

	startStr := startDate.Format("2006-01-02 00:00:00")
	endStr := endDate.Format("2006-01-02 23:59:59")

	var totalOrders, cashCount, cardCount, transferCount int
	var totalSales float64

	// 1. Totales Generales
	query1 := `
		SELECT
			COUNT(id), COALESCE(SUM(total), 0.0),
			COUNT(CASE WHEN LOWER(payment_method) IN ('cash', 'efectivo') THEN 1 END),
			COUNT(CASE WHEN LOWER(payment_method) IN ('card', 'tarjeta') THEN 1 END),
			COUNT(CASE WHEN LOWER(payment_method) IN ('transfer', 'transferencia') THEN 1 END)
		FROM tickets
		WHERE status IN ('paid', 'completed') AND created_at BETWEEN ? AND ?
	`
/* = r.DB.QueryRowContext(ctx, query1, startStr, endStr).Scan(
		&totalOrders, &totalSales, &cashCount, &cardCount, &transferCount,
	) */

	err := r.DB.QueryRowContext(ctx, query1, startStr, endStr).Scan(
		&totalOrders, &totalSales, &cashCount, &cardCount, &transferCount,
	)
	if err != nil {
		log.Println("❌ ERROR EN QUERY 1 (DASHBOARD):", err)
	}

	stats.TotalOrders = totalOrders
	stats.TotalSales = totalSales
	stats.CashCount = cashCount
	stats.CardCount = cardCount
	stats.TransferCount = transferCount
	if totalOrders > 0 {
		stats.AverageTicket = totalSales / float64(totalOrders)
	}

	// 2. Categorías (Uniendo la tabla de productos de forma )
	query2 := `
		SELECT 
			COALESCE(NULLIF(p.category, ''), 'Otros'), COALESCE(SUM(tl.quantity * p.unit_price), 0.0), CAST(COALESCE(SUM(tl.quantity), 0) AS SIGNED)
		FROM ticket_lines tl
		INNER JOIN tickets t ON t.id = tl.ticket_id
		LEFT JOIN products p ON p.id = tl.product_id
		WHERE t.status IN ('paid', 'completed') AND t.created_at BETWEEN ? AND ?
		GROUP BY COALESCE(NULLIF(p.category, ''), 'Otros')
		ORDER BY 2 DESC
	`
	rows2, err := r.DB.QueryContext(ctx, query2, startStr, endStr)
	if err == nil {
		defer rows2.Close()
		for rows2.Next() {
			var c model.CategoryStat
			rows2.Scan(&c.Category, &c.Total, &c.Quantity)
			stats.CategoryStats = append(stats.CategoryStats, c)
		}
	}

	// 3. Ventas Diarias (Seguro contra solo full group by)
	query3 := `
		SELECT DATE_FORMAT(created_at, '%Y-%m-%d'), COALESCE(SUM(total), 0.0)
		FROM tickets
		WHERE status IN ('paid', 'completed') AND created_at BETWEEN ? AND ?
		GROUP BY DATE_FORMAT(created_at, '%Y-%m-%d')
		ORDER BY 1 ASC
	`
	rows3, err := r.DB.QueryContext(ctx, query3, startStr, endStr)
	if err == nil {
		defer rows3.Close()
		for rows3.Next() {
			var d model.DailySaleStat
			rows3.Scan(&d.Date, &d.Total)
			stats.DailySales = append(stats.DailySales, d)
		}
	}

	return stats, nil
}