# Stage 1: Build frontend
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Stage 2: Production server
# Note: nginx.conf is kept in deployment/docker/nginx.conf for rollback purposes
FROM node:20-alpine
WORKDIR /app

# Create non-root user
RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001

# Copy package files and install production deps only
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Copy server code and built frontend
COPY --from=builder /app/dist ./dist
COPY server ./server

# Create data directory for SQLite with correct permissions
RUN mkdir -p /data && chown nodejs:nodejs /data

USER nodejs

EXPOSE 3000

ENV NODE_ENV=production

CMD ["node", "server/index.js"]
