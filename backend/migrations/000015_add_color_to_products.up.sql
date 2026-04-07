-- Agregamos la columna color (por defecto vacío para no romper los productos viejos)
ALTER TABLE products ADD COLUMN color VARCHAR(50) NOT NULL DEFAULT '';

-- Creamos un índice para que filtrar por color sea ultra rápido
CREATE INDEX idx_color ON products (color);