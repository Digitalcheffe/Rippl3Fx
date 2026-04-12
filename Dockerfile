# Stage 1: Build frontend
FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# Stage 2: Production
FROM node:20-alpine
WORKDIR /app

# Copy backend and install production deps
COPY backend/package.json backend/package-lock.json ./
RUN npm ci --production
COPY backend/ ./

# Build backend TypeScript
RUN npm install -g typescript && tsc && npm uninstall -g typescript

# Copy frontend build output into dist/ (where Express serves it)
COPY --from=frontend-builder /app/frontend/dist ./dist

# Create data directory for SQLite
RUN mkdir -p /app/data

EXPOSE 3000

CMD ["node", "dist/index.js"]
