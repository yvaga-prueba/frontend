package entity

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"strings"

	errorcode "core/api/error_code"
	"core/domain/model"
	"core/domain/repo"

	mysqlerr "github.com/go-sql-driver/mysql"
)


type ProductRepo struct {
	DB *sql.DB
}


func NewProductRepository(db *sql.DB) *ProductRepo { return &ProductRepo{DB: db} }


var _ repo.ProductRepository = (*ProductRepo)(nil)

func (r *ProductRepo) Create(ctx context.Context, p *model.Product) error {
	
	res, err := r.DB.ExecContext(ctx, `
		INSERT INTO products (bar_code, title, description, stock, size, color, gender, category, unit_price)
		VALUES (?,?,?,?,?,?,?,?,?)`,
		p.BarCode, p.Title, p.Description, p.Stock, p.Size, p.Color, p.Gender, p.Category, p.UnitPrice,
	)
	if err != nil {
		var me *mysqlerr.MySQLError
		
		if errors.As(err, &me) && me.Number == 1062 {
			return errorcode.ErrConflict
		}
		return err
	}
	
	
	id, _ := res.LastInsertId()
	p.ID = id
	return nil
}

func (r *ProductRepo) Read(ctx context.Context) ([]model.Product, error) {
	
	q := `SELECT id, bar_code, title, description, stock, size, color, gender, category, unit_price, updated_at, created_at 
		FROM products`

	rows, err := r.DB.QueryContext(ctx, q)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []model.Product
	
	for rows.Next() {
		var p model.Product
		if err := rows.Scan(&p.ID, &p.BarCode, &p.Title, &p.Description, &p.Stock, &p.Size, &p.Color, &p.Gender, &p.Category, &p.UnitPrice, &p.UpdatedAt, &p.CreatedAt); err != nil {
			return nil, err
		}
		out = append(out, p)
	}
	return out, rows.Err()
}

func (r *ProductRepo) Update(ctx context.Context, product *model.Product) error {
	
	query := `
		UPDATE products
		SET bar_code = ?, title = ?, description = ?, stock = ?, size = ?, color = ?, gender = ?, category = ?, unit_price = ?, updated_at = NOW()
		WHERE id = ?
	`
	result, err := r.DB.ExecContext(ctx, query,
		product.BarCode,
		product.Title,
		product.Description,
		product.Stock,
		product.Size,
		product.Color,
		product.Gender,
		product.Category,
		product.UnitPrice,
		product.ID,
	)
	if err != nil {
		return fmt.Errorf("failed to update product: %w", err)
	}

	rows, err := result.RowsAffected()
	if err != nil {
		return err
	}

	
	if rows == 0 {
		return fmt.Errorf("product not found")
	}

	return nil
}

func (r *ProductRepo) Delete(ctx context.Context, id int64) error {
	
	query := `DELETE FROM products WHERE id = ?`

	result, err := r.DB.ExecContext(ctx, query, id)
	if err != nil {
		return fmt.Errorf("failed to delete product: %w", err)
	}

	rows, err := result.RowsAffected()
	if err != nil {
		return err
	}

	
	if rows == 0 {
		return fmt.Errorf("product not found")
	}

	return nil
}

func (r *ProductRepo) GetByID(ctx context.Context, id int64) (*model.Product, error) {
	var p model.Product
	// Busco un producto específico. Uso QueryRowContext porque sé que a lo sumo me tiene que devolver una sola fila.
	err := r.DB.QueryRowContext(ctx, `
		SELECT id, bar_code, title, description, stock, size, color, gender, category, unit_price, updated_at, created_at
		FROM products WHERE id = ?`, id).
		Scan(&p.ID, &p.BarCode, &p.Title, &p.Description, &p.Stock, &p.Size, &p.Color, &p.Gender, &p.Category, &p.UnitPrice, &p.UpdatedAt, &p.CreatedAt)
	
	// Si MySQL me dice que no hay resultados, devuelvo mi error personalizado para manejarlo limpio en el frontend
	if errors.Is(err, sql.ErrNoRows) {
		return nil, errorcode.ErrNotFound
	}
	return &p, err
}

func (r *ProductRepo) List(ctx context.Context, f model.ProductFilter) ([]model.Product, error) {
	
	q := `
		SELECT id, bar_code, title, description, stock, size, color, gender, category, unit_price, updated_at, created_at
		FROM products WHERE 1=1` // El 1=1 es un truco para poder concatenar los "AND" sin romper la sintaxis
	args := []any{}
	
	// Voy chequeando qué filtros me pasaron y los agrego a la consulta
	if f.Category != "" {
		q += " AND category = ?"
		args = append(args, f.Category)
	}
	if f.Size != "" {
		q += " AND size = ?"
		args = append(args, f.Size)
	}
	if f.Color != "" {
		q += " AND color = ?"
		args = append(args, f.Color)
	}
	if f.Gender != "" {
		q += " AND gender = ?"
		args = append(args, f.Gender)
	}
	if f.Query != "" {
		// Búsqueda flexible por nombre o descripción usando like
		q += " AND (title LIKE ? OR description LIKE ?)"
		like := "%" + f.Query + "%"
		args = append(args, like, like)
	}
	
	// Ordeno para mostrar lo más nuevo primero
	q += " ORDER BY created_at DESC"
	
	// Configuro la paginación para no traer toda la base de datos de golpe y colapsar la memoria
	limit := 20
	if f.Limit > 0 && f.Limit <= 100 {
		limit = f.Limit
	}
	offset := f.Offset
	q += " LIMIT ? OFFSET ?"
	args = append(args, limit, offset)

	rows, err := r.DB.QueryContext(ctx, q, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []model.Product
	for rows.Next() {
		var p model.Product
		if err := rows.Scan(&p.ID, &p.BarCode, &p.Title, &p.Description, &p.Stock, &p.Size, &p.Color, &p.Gender, &p.Category, &p.UnitPrice, &p.UpdatedAt, &p.CreatedAt); err != nil {
			return nil, err
		}
		out = append(out, p)
	}
	return out, rows.Err()
}

func (r *ProductRepo) UpdateStock(ctx context.Context, id int64, delta int64) error {
	
	res, err := r.DB.ExecContext(ctx, `UPDATE products SET stock = stock + ? WHERE id = ?`, delta, id)
	if err != nil {
		return err
	}
	aff, _ := res.RowsAffected()
	if aff == 0 {
		return errorcode.ErrNotFound
	}
	return nil
}

func (r *ProductRepo) GetVariantsByTitle(ctx context.Context, title string) ([]model.Product, error) {
	// Agrupo los productos que son el mismo modelo pero tienen distintos talles o colores
	q := `SELECT id, bar_code, title, description, stock, size, color, gender, category, unit_price, updated_at, created_at 
		FROM products WHERE title = ? ORDER BY id ASC`

	rows, err := r.DB.QueryContext(ctx, q, title)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []model.Product
	for rows.Next() {
		var p model.Product
		if err := rows.Scan(&p.ID, &p.BarCode, &p.Title, &p.Description, &p.Stock, &p.Size, &p.Color, &p.Gender, &p.Category, &p.UnitPrice, &p.UpdatedAt, &p.CreatedAt); err != nil {
			return nil, err
		}
		out = append(out, p)
	}
	return out, rows.Err()
}

func (r *ProductRepo) GetRelated(ctx context.Context, category string, excludeID int64, limit int) ([]model.Product, error) {
	// Buscamos el titulo del producto que el usuario está viendo actualmente
	// para no pasarle el mismo producto
	var excludeTitle string
	err := r.DB.QueryRowContext(ctx, "SELECT title FROM products WHERE id = ?", excludeID).Scan(&excludeTitle)
	if err != nil && err != sql.ErrNoRows {
		return nil, err
	}

	// Normalizo el titulo actual, paso a minuscula y le saco los espacios al final 
	excludeTitleNorm := strings.ToLower(strings.TrimSpace(excludeTitle))

	// Traemos prendas de la misma categoría, pero acá solo filtramos por ID. 
	// El filtro del titulo lo hacemos abajo ya con los textos limpios.
	q := `SELECT id, bar_code, title, description, stock, size, color, gender, category, unit_price, updated_at, created_at 
	      FROM products 
	      WHERE category = ? AND id != ? 
	      ORDER BY created_at DESC`

	rows, err := r.DB.QueryContext(ctx, q, category, excludeID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []model.Product
	
	// anotá que titulos ya agrego a la lista
	seenTitles := make(map[string]bool)

	for rows.Next() {
		var p model.Product
		if err := rows.Scan(&p.ID, &p.BarCode, &p.Title, &p.Description, &p.Stock, &p.Size, &p.Color, &p.Gender, &p.Category, &p.UnitPrice, &p.UpdatedAt, &p.CreatedAt); err != nil {
			return nil, err
		}
		
		// limpio el titulo de la base de datos para compararlo bien (sin mayúsculas ni espacios ocultos)
		titleLimpio := strings.ToLower(strings.TrimSpace(p.Title))

		// si es la misma familia del producto principal, o si ya seleccionó otro con el mismo nombre, no lo manda
		if titleLimpio == excludeTitleNorm || seenTitles[titleLimpio] {
			continue
		}
		
		// Como es un modelo nuevo, lo marco como visto y lo agrego a los resultados
		seenTitles[titleLimpio] = true
		out = append(out, p)
		
		// cuando encuentra 4 prendas , corta y manda al front
		if len(out) >= limit {
			break
		}
	}
	
	return out, rows.Err()
}