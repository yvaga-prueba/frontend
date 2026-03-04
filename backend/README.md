# Core Shop

# Make

Run in Windows:
mingw32-make <flag>

# Structure files

In tree_output.txt

# AFIP

## Generar key
openssl genrsa -out yvaga-qa-priv.key 2048

## Generar Certificado
penssl req -new -key yvaga-qa-priv.key -out mi_solicitud.csr -subj "/C=AR/O=yvaga/serialNumber=CUIT 20335645856/CN=yvagaqa"

## Controlar bits
openssl rsa -in yvaga-qa-priv.key -text -noout

## Controlar CUIT
openssl req -in mi_solicitud.csr -noout -text
