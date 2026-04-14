#!/bin/sh
# Inyecta las variables de entorno con prefijo PUBLIC_VAR_ en app-config.js
/scripts/inject_public_vars.sh /usr/share/nginx/html/assets/app-config.js "PUBLIC_VAR_"
chmod 664 /usr/share/nginx/html/assets/app-config.js
# Inicia nginx
nginx -g 'daemon off;'
