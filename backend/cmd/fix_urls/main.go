package main

import (
	"database/sql"
	"fmt"
	"log"

	"core/config"

	_ "github.com/go-sql-driver/mysql"
)

func main() {
	cfg, err := config.Load()
	if err != nil {
		log.Fatal(err)
	}

	db, err := sql.Open("mysql", cfg.DSN)
	if err != nil {
		log.Fatal(err)
	}
	defer db.Close()

	// Obtener todas las imágenes
	rows, err := db.Query("SELECT id, url, drive_file_id FROM product_images")
	if err != nil {
		log.Fatal(err)
	}
	defer rows.Close()

	updates := 0
	for rows.Next() {
		var id int64
		var url string
		var driveFileID sql.NullString
		if err := rows.Scan(&id, &url, &driveFileID); err != nil {
			log.Fatal(err)
		}

		// Si tiene drive_file_id valido, usamos el nuevo proxy endpoint
		if driveFileID.Valid && driveFileID.String != "" {
			newURL := fmt.Sprintf("/api/images/%s", driveFileID.String)
			if url != newURL {
				_, err = db.Exec("UPDATE product_images SET url = ? WHERE id = ?", newURL, id)
				if err != nil {
					log.Printf("Error actualizando imagen %d: %v", id, err)
				} else {
					updates++
					fmt.Printf("Imagen %d actualizada al nuevo proxy local (/api/images).\n", id)
				}
			}
		} else {
			fmt.Printf("Imagen %d NO se pudo actualizar (no tiene drive_file_id válido).\n", id)
		}
	}
	fmt.Printf("Listo. %d URLs actualizadas en la base de datos a formato proxy.\n", updates)
}
