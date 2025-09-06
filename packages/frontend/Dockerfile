# Frontend Dockerfile - React Application (Monorepo)
FROM node:18-alpine

# Set working directory inside container
WORKDIR /app

# Copy root workspace files first
COPY package*.json ./
COPY packages/frontend/package.json ./packages/frontend/

# Install all workspace dependencies from root
RUN npm install

# Copy frontend source code
COPY packages/frontend/ ./packages/frontend/

# Set working directory to frontend package
WORKDIR /app/packages/frontend

# Expose the port Vite runs on
EXPOSE 3000

# Health check to ensure Vite dev server is running
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000 || exit 1

# Start Vite development server with no browser opening
# --host 0.0.0.0 makes it accessible from outside the container
# --no-open prevents trying to open browser in container
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0", "--no-open"]