# Stage 1: Build the React frontend
FROM node:20-alpine AS builder

WORKDIR /frontend

# Copy frontend source (from the root of life-os project)
COPY frontend/package*.json ./
RUN npm ci

COPY frontend/ ./

# Build the production React app
# VITE_HA_URL is empty on purpose: when served from the addon itself,
# all HA API calls use relative paths (/api/...) which go through Ingress.
RUN VITE_HA_URL="" npm run build

# ─────────────────────────────────────────────
# Stage 2: Runtime – Node.js server
# ─────────────────────────────────────────────
ARG BUILD_FROM=ghcr.io/hassio-addons/base:14.3.3
FROM ${BUILD_FROM}

# Install Node.js
RUN apk add --no-cache nodejs npm

WORKDIR /app

# Copy server dependencies and install
COPY package.json ./
RUN npm install --production

# Copy server code
COPY server.js ./

# Copy built frontend from Stage 1
COPY --from=builder /frontend/dist ./dist

# Copy startup script
COPY run.sh /run.sh
RUN chmod a+x /run.sh

CMD ["/run.sh"]
