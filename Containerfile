# ── Builder ──────────────────────────────────────────────────────────────────
FROM node:24-alpine3.21 AS builder

WORKDIR /app

# Cache de dependencias separado del código fuente
COPY package*.json ./
RUN npm ci

COPY . .

RUN npx ng build --configuration=production

# ── Runner ────────────────────────────────────────────────────────────────────
FROM nginx:stable-alpine3.21 AS runner

RUN rm -rf /usr/share/nginx/html/*

COPY --from=builder /app/dist/rolateam_frontend/browser/ /usr/share/nginx/html/
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY scripts/ /scripts/
RUN chmod +x /scripts/inject_public_vars.sh /scripts/start-server.sh

EXPOSE 80

ENTRYPOINT ["/scripts/start-server.sh"]
CMD ["nginx"]