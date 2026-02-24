-- Revierte el ENUM al estado original (sin 'pending')
-- NOTA: los tickets con status='pending' deben eliminarse antes de correr este down
ALTER TABLE tickets
    MODIFY COLUMN status ENUM('paid', 'completed', 'cancelled') NOT NULL DEFAULT 'paid';
