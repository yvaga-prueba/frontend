-- Hace que paid_at sea nullable para tickets con status 'pending'
ALTER TABLE tickets
    MODIFY COLUMN paid_at TIMESTAMP NULL DEFAULT NULL;
