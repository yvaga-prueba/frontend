FROM node:24-alpine3.21 as build
WORKDIR /app
COPY package*.json ./
RUN npm install -g @angular/cli && npm install
COPY . .
RUN ng build --configuration=production

FROM nginx:stable-alpine3.21 as runner
RUN rm -rf /usr/share/nginx/html/*
COPY --from=build /app/dist/rolateam_frontend/browser/ /usr/share/nginx/html/
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]