-- Agrega columnas para AFIP (Facturación Electrónica)
ALTER TABLE tickets
    ADD COLUMN invoice_type VARCHAR(2) NULL COMMENT 'A, B, C',
    ADD COLUMN invoice_number VARCHAR(20) NULL COMMENT '0001-00000001',
    ADD COLUMN cae VARCHAR(20) NULL,
    ADD COLUMN cae_due_date DATE NULL;
