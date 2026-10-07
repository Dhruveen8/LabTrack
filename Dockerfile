# Build stage
FROM node:22-alpine AS build
WORKDIR /app

# Accept VITE_API_URL as build argument — defaults to /api/v1 for nginx proxy
ARG VITE_API_URL=/api/v1
ENV VITE_API_URL=$VITE_API_URL

# Copy package files and install dependencies
COPY package*.json ./
RUN npm install

# Copy project files and build
COPY . .
RUN npm run build

# Serve stage
FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
