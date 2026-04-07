CREATE TABLE size_guides (
    id INT AUTO_INCREMENT PRIMARY KEY,
    category VARCHAR(100) NOT NULL, -- Ej: 'Remeras', 'Pantalones'
    size VARCHAR(10) NOT NULL,      -- Ej: 'S', 'M', 'L', 'XL'
    min_weight DECIMAL(5,2) NOT NULL, -- Peso mínimo en KG
    max_weight DECIMAL(5,2) NOT NULL, -- Peso máximo en KG
    min_height DECIMAL(5,2) NOT NULL, -- Altura mínima en CM
    max_height DECIMAL(5,2) NOT NULL, -- Altura máxima en CM
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);