# script.ps1

# Ejecutar swag init
swag init -g cmd/api/main.go -o docs

# Verificar si el comando fue exitoso
if ($LASTEXITCODE -eq 0) {
    Write-Host "Swagger documentation generated successfully" -ForegroundColor Green
    
    # Ruta al archivo docs.go
    $docsFile = "docs\docs.go"
    
    # Verificar si el archivo existe
    if (Test-Path $docsFile) {
        Write-Host "Cleaning up docs.go..." -ForegroundColor Yellow
        
        # Leer el contenido del archivo
        $content = Get-Content $docsFile -Raw
        
        # Eliminar las líneas LeftDelim y RightDelim
        $content = $content -replace '\s*LeftDelim:\s*"{{",\s*\r?\n', ''
        $content = $content -replace '\s*RightDelim:\s*"}}",\s*\r?\n', ''
        
        # Guardar el archivo modificado
        $content | Set-Content $docsFile -NoNewline
        
        Write-Host "docs.go cleaned successfully" -ForegroundColor Green
    } else {
        Write-Host "Warning: docs.go not found at $docsFile" -ForegroundColor Red
    }
} else {
    Write-Host "Error: swag init failed" -ForegroundColor Red
    exit 1
}