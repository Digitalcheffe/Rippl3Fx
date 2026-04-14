# Stage 1: Build frontend
FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci --legacy-peer-deps
COPY frontend/ ./
RUN npm run build

# Stage 2: Build backend
FROM node:20-alpine AS backend-builder
WORKDIR /app
COPY backend/package.json backend/package-lock.json ./
RUN npm ci
COPY backend/ ./
RUN npx tsc

# Stage 3: Production
FROM node:20-alpine
WORKDIR /app

# Copy backend package files and install production deps only (native modules built for Alpine)
COPY backend/package.json backend/package-lock.json ./
RUN npm ci --production

# Copy compiled backend JS
COPY --from=backend-builder /app/dist ./dist

# Copy backend source (needed for migrations SQL files at runtime)
COPY backend/src/db/migrations ./src/db/migrations

# Copy frontend build output into dist/ (coexists with backend JS — index.html + assets/)
COPY --from=frontend-builder /app/frontend/dist ./dist

# Default data directory — mount a volume here to persist
RUN mkdir -p /data
ENV DATA_DIR=/data

EXPOSE 3000

CMD ["node", "dist/index.js"]
