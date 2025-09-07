# realtime-messenger
A real-time messaging application built with React, TypeScript, tRPC, and PostgreSQL. Features instant messaging, thread-based conversations, and WebSocket communication.

##  Quick Start with Docker (Recommended)

The easiest way to get started! Docker handles database setup, migrations, and seeding automatically.

**Prerequisites:** Docker and Docker Compose installed

```bash
# Clone the repository
git clone <repository-url>
cd realtime-messenger

# Start all services (includes database setup)
docker-compose up

# Access the application
# Frontend: http://localhost:3000
# Backend API: http://localhost:4000
```

**Test Users:**
- Username: `alice`, `bob`, `charlie`  
- Password: `password123`

## Local Development Setup (Alternative)

For developers who prefer running services locally without Docker.

**Prerequisites:** Node.js >= 18, PostgreSQL

```bash
# Install dependencies
npm install

# Set up database
createdb realtime_messenger
cd packages/backend
cp .env.example .env  # Update with your database credentials

# Run migrations and seed
npx prisma migrate dev
npm run db:seed

# Start development servers
npm run dev  # Starts both frontend and backend
```

**Note:** Local setup requires manual PostgreSQL installation and configuration. Docker setup is recommended for simplicity.
