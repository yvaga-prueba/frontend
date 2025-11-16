CREATE TABLE IF NOT EXISTS products (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    bar_code BIGINT NOT NULL UNIQUE,
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    stock BIGINT NOT NULL DEFAULT 0,
    size ENUM('S', 'M', 'L', 'XL', 'XXL') NOT NULL,
    category VARCHAR(100) NOT NULL,
    unit_price DECIMAL(10, 2) NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_category (category),
    INDEX idx_size (size),
    INDEX idx_bar_code (bar_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO products (bar_code, title, description, stock, size, category, unit_price) VALUES
(7501234567890, 'Remera Básica Negra', 'Remera de algodón 100% color negro, cuello redondo', 50, 'M', 'Remeras', 2500.00),
(7501234567891, 'Remera Básica Negra', 'Remera de algodón 100% color negro, cuello redondo', 30, 'L', 'Remeras', 2500.00),
(7501234567892, 'Remera Básica Blanca', 'Remera de algodón 100% color blanco, cuello redondo', 45, 'M', 'Remeras', 2500.00),
(7501234567893, 'Remera Estampada', 'Remera con estampado gráfico, algodón premium', 25, 'L', 'Remeras', 3200.00),
(7501234567894, 'Remera Deportiva', 'Remera técnica dry-fit para deportes', 40, 'XL', 'Deportivo', 3800.00),
(7501234567895, 'Buzo Canguro Gris', 'Buzo con capucha y bolsillo canguro, algodón frizado', 20, 'L', 'Buzos', 5500.00),
(7501234567896, 'Buzo Canguro Gris', 'Buzo con capucha y bolsillo canguro, algodón frizado', 15, 'XL', 'Buzos', 5500.00),
(7501234567897, 'Buzo Canguro Negro', 'Buzo con capucha y bolsillo canguro, algodón frizado', 18, 'M', 'Buzos', 5500.00),
(7501234567898, 'Campera Rompeviento', 'Campera impermeable con capucha ajustable', 12, 'L', 'Camperas', 8900.00),
(7501234567899, 'Campera Jean', 'Campera de jean clásica con forro interno', 10, 'M', 'Camperas', 7500.00),
(7501234567900, 'Pantalón Jogger Negro', 'Pantalón jogger de algodón con puños elastizados', 35, 'M', 'Pantalones', 4200.00),
(7501234567901, 'Pantalón Jogger Negro', 'Pantalón jogger de algodón con puños elastizados', 28, 'L', 'Pantalones', 4200.00),
(7501234567902, 'Pantalón Cargo', 'Pantalón cargo con múltiples bolsillos', 22, 'L', 'Pantalones', 4800.00),
(7501234567903, 'Jean Slim Fit', 'Jean corte slim fit, color azul oscuro', 30, 'M', 'Pantalones', 6500.00),
(7501234567904, 'Jean Slim Fit', 'Jean corte slim fit, color azul oscuro', 25, 'L', 'Pantalones', 6500.00),
(7501234567905, 'Short Deportivo', 'Short de microfibra para entrenamiento', 40, 'M', 'Deportivo', 2800.00),
(7501234567906, 'Short Deportivo', 'Short de microfibra para entrenamiento', 35, 'L', 'Deportivo', 2800.00),
(7501234567907, 'Musculosa Básica', 'Musculosa de algodón lisa', 50, 'M', 'Remeras', 1800.00),
(7501234567908, 'Chomba Piqué', 'Chomba de piqué con cuello y botones', 20, 'L', 'Remeras', 3500.00),
(7501234567909, 'Sweater Cuello Alto', 'Sweater de lana con cuello alto', 15, 'XL', 'Buzos', 6200.00),
(7501234567910, 'Remera Oversize', 'Remera corte oversize, tendencia urbana', 30, 'L', 'Remeras', 2900.00),
(7501234567911, 'Buzo Crewneck', 'Buzo sin capucha, cuello redondo', 25, 'M', 'Buzos', 4800.00),
(7501234567912, 'Campera Bomber', 'Campera estilo bomber con cierre', 8, 'L', 'Camperas', 9500.00),
(7501234567913, 'Remera Manga Larga', 'Remera básica de manga larga', 40, 'M', 'Remeras', 2700.00),
(7501234567914, 'Remera Manga Larga', 'Remera básica de manga larga', 35, 'L', 'Remeras', 2700.00);

CREATE TABLE IF NOT EXISTS product_images (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    product_id BIGINT NOT NULL,
    url VARCHAR(500) NOT NULL,
    is_primary BOOLEAN NOT NULL DEFAULT FALSE,
    position INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
    INDEX idx_product_id (product_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;