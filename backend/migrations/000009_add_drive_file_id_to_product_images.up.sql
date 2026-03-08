-- Agrega columna drive_file_id a product_images para poder eliminar archivos de Google Drive
ALTER TABLE product_images
    ADD COLUMN drive_file_id VARCHAR(255) NOT NULL DEFAULT '' AFTER url;
