# Multi-stage build for Life OS

# Stage 1: Frontend build
FROM node:20-alpine AS frontend-build

WORKDIR /build/frontend

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --frozen-lockfile

# Copy source code
COPY tsconfig*.json vite.config.ts tailwind.config.js eslint.config.js ./
COPY src ./src
COPY public ./public
COPY index.html ./

# Build frontend
RUN npm run build

# Stage 2: Backend dependencies
FROM node:20-alpine AS backend-deps

WORKDIR /build/backend

# Copy backend package files
COPY backend/package*.json ./

# Install production dependencies only
RUN npm ci --frozen-lockfile --omit=dev

# Stage 3: Runtime image
FROM node:20-alpine

WORKDIR /app

# Copy production dependencies from backend stage
COPY --from=backend-deps --chown=node:node /build/backend/node_modules ./backend/node_modules

# Copy built frontend from frontend build stage
COPY --from=frontend-build --chown=node:node /build/frontend/dist ./dist

# Copy backend source code
COPY --chown=node:node backend/server.js ./backend/
COPY --chown=node:node backend/config.yaml ./backend/

# Copy root package.json for runtime reference
COPY --chown=node:node package.json ./

# Set environment variables
ENV NODE_ENV=production
ENV PORT=8099

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD node -e "require('http').get('http://localhost:8099', (r) => {if (r.statusCode !== 200) throw new Error(r.statusCode)})"

EXPOSE 8099

# Run as non-root user
USER node

CMD ["node", "backend/server.js"]
