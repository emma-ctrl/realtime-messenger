# Realtime Messenger - Project Plan

## Project Overview

Building a real-time messaging application similar to WhatsApp/Facebook Messenger with the following requirements:
- **Time Constraint**: 4-6 hours maximum
- **Focus**: Code quality and functionality over design
- **Tech Stack**: React + TypeScript + Node.js + PostgreSQL

## Core Requirements

### 1. Login Page
- Username and password authentication
- No registration/forgot password (hardcoded users)

### 2. Messaging Page
- List of open threads with last message preview
- Create new thread functionality (DMs only)
- Real-time message updates (no page refresh needed)
- Messages in chronological order (latest at bottom)

### 3. Documentation
- README with setup and run instructions

## Architecture Decisions

### Backend: Node.js + TypeScript
**Why Node.js over Python:**
- Shared language with frontend (TypeScript)
- Native Socket.io support for real-time features
- Better ecosystem for chat applications
- Seamless type sharing between frontend/backend

### API: tRPC
**Why tRPC over GraphQL/gRPC:**
- End-to-end type safety with minimal setup
- Perfect for TypeScript monorepos
- Built-in real-time subscriptions
- No code generation required
- Faster development within time constraints

### Database: PostgreSQL + Prisma
**Why PostgreSQL:**
- Specified as preferred in requirements
- Better JSON support for future message metadata
- ACID compliance important for messaging

**Why Prisma over raw `pg`:**
- 50% faster development due to auto-generated CRUD
- Type-safe database operations
- Built-in migration system
- Seamless tRPC integration
- Compile-time error prevention

### Real-time: Socket.io
**Why Socket.io over alternatives:**
- **Automatic fallbacks**: WebSocket → Long Polling → Regular Polling
  - Corporate networks that block WebSockets
  - Spotty mobile connections
  - Network switching (WiFi → Mobile data)
- **Built-in features**: Rooms, namespaces, reconnection handling
- **Industry standard** for chat applications
- **Event-based architecture** for clean message handling

### Frontend Build Tool: Vite
**Why Vite over alternatives:**
- **Lightning-fast dev server**: ESM-native, no bundling in dev mode
- **Instant HMR**: Updates in <50ms vs 1-3s with Webpack
- **Zero config TypeScript**: Works out of the box
- **Perfect for 4-6 hour constraint**: Minimal setup overhead
- **Built-in optimizations**: Tree shaking, code splitting, asset optimization

**Create React App (Rejected):**
- Slow Webpack dev server, configuration complexity

**Next.js (Rejected):**
- Feature mismatch (SSR not needed), file-based routing overkill

**Raw Webpack (Rejected):**
- Hours of setup time, slow builds, maintenance overhead

## Database Schema

```sql
-- Users table
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Threads table (supports both DMs and future group chats)
CREATE TABLE threads (
    id SERIAL PRIMARY KEY,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Thread participants (many-to-many relationship)
CREATE TABLE thread_participants (
    thread_id INTEGER REFERENCES threads(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    joined_at TIMESTAMP DEFAULT NOW(),
    PRIMARY KEY (thread_id, user_id)
);

-- Messages table
CREATE TABLE messages (
    id SERIAL PRIMARY KEY,
    thread_id INTEGER REFERENCES threads(id) ON DELETE CASCADE,
    sender_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);
```

### Schema Benefits
- **Scalable**: Supports both DMs (2 users) and future group chats (3+ users)
- **Performant**: Proper indexing and relationships
- **Extensible**: Easy to add thread names, metadata, etc.
- **Clean queries**: Simple JOIN operations

### Alternative Schemas Rejected
1. **Direct user-to-user messages**: Complex conversation queries, no group support
2. **Denormalized participants**: Data duplication, update complexity
3. **No threads table**: Missing metadata, orphaned IDs
4. **Over-engineered conversations**: Feature creep, time constraints

## Tech Stack Summary

```
Frontend: React + TypeScript + Tailwind + tRPC Client + Socket.io Client
Backend:  Node.js + TypeScript + tRPC + Socket.io + Express + Prisma
Database: PostgreSQL
Auth:     JWT with httpOnly cookies
```

## Authentication Strategy

### JWT vs Alternatives Analysis

**JWT (Chosen):**
- **Stateless**: No server-side session storage required
- **Socket.io Integration**: Easy to pass token in WebSocket handshake
- **Time Efficient**: Minimal setup overhead for 4-6 hour constraint
- **Type Safety**: Can include typed user data in token payload
- **Simple with tRPC**: Clean middleware integration

**Session-Based (Rejected):**
- **More Secure**: Can revoke sessions immediately
- **Complex Setup**: Requires Redis/session store configuration
- **Socket.io Complexity**: Need session sharing across HTTP and WebSocket
- **Time Constraint**: Too much setup overhead

**OAuth (Rejected):**
- **Better UX**: One-click login with existing accounts
- **Setup Complexity**: OAuth app registration required
- **Requirements Conflict**: Task specifically asks for username/password
- **External Dependency**: Adds third-party service complexity

### JWT Security Implementation
```typescript
// Short expiration times
const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '2h' });

// HttpOnly cookies (not localStorage)
res.cookie('auth-token', token, { 
  httpOnly: true, 
  secure: true, 
  sameSite: 'strict' 
});

// Validation in both tRPC and Socket.io
```

## Development Timeline (4-6 hours)

### Phase 1: Setup & Foundation (45 minutes)
- [ ] Initialize repositories (frontend/backend)
- [ ] Setup PostgreSQL database
- [ ] Configure Prisma schema
- [ ] Setup tRPC boilerplate
- [ ] Basic project structure

### Phase 2: Authentication (45 minutes)
- [ ] JWT authentication system
- [ ] Hardcoded users in database seeder
- [ ] Login API endpoint
- [ ] Protected routes middleware
- [ ] Basic login UI

### Phase 3: Core Messaging API (90 minutes)
- [ ] tRPC procedures for:
  - Get user threads
  - Create new thread
  - Send message
  - Get thread messages
- [ ] Database operations with Prisma
- [ ] Authentication middleware for tRPC

### Phase 4: Real-time Implementation (90 minutes)
- [ ] Socket.io server setup
- [ ] Room management (users join thread rooms)
- [ ] Message broadcasting
- [ ] Client-side Socket.io integration
- [ ] Real-time message receiving

### Phase 5: Frontend Development (90 minutes)
- [ ] Thread list component
- [ ] Chat interface component
- [ ] Message input component
- [ ] Real-time UI updates
- [ ] Basic responsive layout with Tailwind

### Phase 6: Polish & Documentation (30 minutes)
- [ ] Error handling
- [ ] Loading states
- [ ] README documentation
- [ ] Final testing

## Implementation Priorities

### Must Have (Core Requirements)
1. User login with hardcoded credentials
2. Create DM threads by username
3. Send and receive messages
4. Real-time message updates
5. Thread list with last message

### Nice to Have (If Time Permits)
1. Typing indicators
2. Message timestamps
3. Online status
4. Message delivery status
5. Better error handling

### Won't Have (Out of Scope)
1. User registration
2. Group chats (schema supports, but no UI)
3. Message editing/deletion
4. File attachments
5. Push notifications

## Key Implementation Details

### Socket.io Room Structure
```javascript
// Users join rooms for each thread they participate in
socket.join(`thread_${threadId}`);
// Broadcast messages only to thread participants
io.to(`thread_${threadId}`).emit('new_message', message);
```

### tRPC + Socket.io Integration
```typescript
// tRPC for REST-like operations (get threads, create thread)
// Socket.io for real-time updates (new messages, typing)
```

### Authentication Flow
```
1. Login → JWT token
2. Store JWT in localStorage
3. Include JWT in tRPC headers
4. Include JWT in Socket.io handshake
5. Verify JWT for all protected operations
```

## Success Criteria

### Technical Requirements Met
- [x] Real-time messaging without page refresh
- [x] Thread-based conversations
- [x] Type-safe API between frontend/backend
- [x] PostgreSQL database
- [x] Clean, maintainable code

### Code Quality Standards
- [x] End-to-end type safety
- [x] Error handling
- [x] Clean component structure
- [x] Proper separation of concerns
- [x] Documented setup process

## Risk Mitigation

## Risk Mitigation

### Time Risks
- Start with simplest authentication (hardcoded users)
- Use Prisma for rapid database development
- Prioritize core features over polish

### Technical Risks
- Socket.io provides automatic fallbacks for connection issues
- tRPC ensures type safety across API boundaries
- Prisma prevents SQL injection and type errors

### Scope Creep
- Stick to DM-only implementation
- No fancy UI/design work
- Document what would be added with more time

## Additional Resources

- [Socket.io Documentation](https://socket.io/docs/)
- [tRPC Documentation](https://trpc.io/docs/)
- [Prisma Documentation](https://www.prisma.io/docs/)
- [Next.js + tRPC Example](https://github.com/trpc/trpc/tree/main/examples/next-prisma-starter)

---

**Repository**: `realtime-messenger`  
**Description**: "A real-time messaging application built with React, TypeScript, tRPC, and PostgreSQL. Features instant messaging, thread-based conversations, and WebSocket communication."