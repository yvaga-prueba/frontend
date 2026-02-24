-- Agrega el estado 'pending' al ENUM de tickets
-- Los tickets de MercadoPago se crean como pending y pasan a paid tras confirmación del webhook
ALTER TABLE tickets
    MODIFY COLUMN status ENUM('pending', 'paid', 'completed', 'cancelled') NOT NULL DEFAULT 'pending';
