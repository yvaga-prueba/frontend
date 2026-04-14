#!/bin/sh
# Primer argumento: archivo de salida. Segundo argumento: prefijo (default PUBLIC_VAR_)
prefix="${2:-PUBLIC_VAR_}"
echo "Inyectando variables con prefijo $prefix en archivo $1"

echo "window.appConfig = {};" > "$1"

env | grep "^$prefix" | while read line; do
    key=${line%=*}
    key=${key#${prefix}}
    value=${line#*=}
    echo "Se agrega variable $key=$value"
    echo "window.appConfig.$key='$value';" >> "$1"
done
