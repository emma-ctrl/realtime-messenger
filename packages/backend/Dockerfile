# Backend Dockerfile - Node.js API Server
FROM node:18-alpine

# Install curl for health checks
RUN apk add --no-cache curl

# Set working directory inside container
WORKDIR /app

# Copy package.json files for dependency installation
COPY package*.json ./

# Install all dependencies (including dev dependencies for tsx)
RUN npm ci

# Copy application source code
COPY . .

# Generate Prisma client
RUN npx prisma generate

# Expose the port the app runs on
EXPOSE 4000

# Health check to ensure service is running (we'll create this endpoint later)
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:4000/ || exit 1

# Start script: wait for DB, migrate, seed, then start server
CMD ["sh", "-c", "\
  echo 'Waiting for database to be ready...' && \
  npx prisma migrate deploy && \
  echo '✅ Database migrated successfully' && \
  npx prisma db seed && \
  echo '✅ Database seeded successfully' && \
  echo '🚀 Starting backend server...' && \
  npm run dev \
"]