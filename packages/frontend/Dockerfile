# Frontend Dockerfile - React Application
FROM node:18-alpine

# Set working directory inside container
WORKDIR /app

# Copy package.json for dependency installation
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy application source code
COPY . .

# Expose the port Vite runs on
EXPOSE 3000

# Health check to ensure Vite dev server is running
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000 || exit 1

# Start Vite development server
# --host 0.0.0.0 makes it accessible from outside the container
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]