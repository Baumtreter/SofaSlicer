# Stage 1: React-App bauen
FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json .
RUN npm install
COPY . .
RUN npm run build

# Stage 2: nginx serviert den Build
FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx-app.conf /etc/nginx/conf.d/default.conf
