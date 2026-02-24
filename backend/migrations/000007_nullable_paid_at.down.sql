-- Revierte paid_at a NOT NULL (requiere que no haya tickets con paid_at = NULL)
ALTER TABLE tickets
    MODIFY COLUMN paid_at TIMESTAMP NOT NULL;
