import express from 'express';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import * as trpcExpress from '@trpc/server/adapters/express';

import { createContext } from './trpc/context.js';
import { appRouter } from './trpc/routers/index.js';
import { socketAuthMiddleware, type AuthenticatedSocket } from './socket/auth.js';

const app = express();
const server = createServer(app);
const PORT = process.env.PORT || 4000;

// CORS configuration (shared between Express and Socket.io)
const corsOptions = {
  origin: process.env.FRONTEND_URL || 'http://localhost:3001',
  credentials: true,
};

app.use(cors(corsOptions));
app.use(express.json());
app.use(cookieParser());

// Socket.io server with authentication
const io = new SocketIOServer(server, {
  cors: corsOptions,
  cookie: true, // Enable cookie parsing for authentication
});

// Apply JWT authentication middleware to all socket connections
io.use(socketAuthMiddleware);

/**
 * Socket.io Connection Handler
 * 
 * This runs for every authenticated WebSocket connection.
 * The user is guaranteed to be authenticated due to middleware.
 */
io.on('connection', (socket) => {
  const authSocket = socket as AuthenticatedSocket;
  const { user } = authSocket;
  console.log(`🟢 User connected: ${user.username} (${socket.id})`);

  // Join user to a personal room for direct messaging
  socket.join(`user_${user.id}`);
  console.log(`📂 User ${user.username} joined personal room: user_${user.id}`);

  // Handle disconnection
  socket.on('disconnect', (reason) => {
    console.log(`🔴 User disconnected: ${user.username} (${reason})`);
  });

  // REAL-TIME MESSAGING EVENTS
  
  /**
   * Join Thread Room - User enters a specific conversation
   * 
   * Think of this like joining a Discord channel or Slack room.
   * Only users in the same "room" will receive each other's messages.
   * 
   * Example: Alice and Bob both join "thread_1" room
   * → Now when Alice sends a message, only Bob receives it (and vice versa)
   */
  socket.on('join_thread', (data: { threadId: number }) => {
    const { threadId } = data;
    const roomName = `thread_${threadId}`;
    
    // Add this user to the thread room
    socket.join(roomName);
    
    console.log(`📂 ${user.username} joined thread room: ${roomName}`);
    
    // Optional: Tell others in the room that someone joined
    socket.to(roomName).emit('user_joined_thread', {
      username: user.username,
      userId: user.id,
      threadId: threadId
    });
  });

  /**
   * Broadcast New Message - Real-time message delivery
   * 
   * This is the core real-time feature! When a user sends a message:
   * 1. Frontend calls our tRPC API to save message to database
   * 2. Frontend also sends this Socket.io event
   * 3. Server broadcasts message to all users in the thread room
   * 4. Other users instantly see the new message
   * 
   * Note: We're not saving to database here - tRPC API handles that.
   * This is ONLY for real-time broadcasting to other users.
   */
  socket.on('broadcast_message', (messageData: {
    threadId: number;
    message: {
      id: number;
      content: string;
      createdAt: string;
      sender: { id: number; username: string };
      isFromCurrentUser: boolean;
    }
  }) => {
    const { threadId, message } = messageData;
    const roomName = `thread_${threadId}`;
    
    console.log(`📢 Broadcasting message from ${user.username} to room ${roomName}`);
    console.log(`📝 Message: "${message.content}"`);
    
    // Send message to all OTHER users in the thread room
    // (sender doesn't need to receive their own message)
    socket.to(roomName).emit('new_message', {
      threadId: threadId,
      message: {
        ...message,
        isFromCurrentUser: false // For other users, this message is NOT from them
      }
    });
    
    console.log(`✅ Message broadcasted to thread_${threadId}`);
  });

  // TODO: Future real-time features
  // - typing_start/stop: Show when someone is typing
  // - user_online: Show who's currently online
  // - message_read: Show when messages are read
});

// Express routes
app.get('/', (_req, res) => {
  res.json({ 
    message: 'Realtime Messenger API', 
    status: 'healthy',
    timestamp: new Date().toISOString(),
    features: {
      tRPC: 'Enabled',
      socketIO: 'Enabled',
      authentication: 'JWT + httpOnly cookies',
    }
  });
});

app.use('/api/trpc', trpcExpress.createExpressMiddleware({
  router: appRouter,
  createContext: (opts) => createContext(opts, io), // Pass Socket.io server to context
  onError: ({ path, error }) => {
    console.error(`❌ tRPC Error on '${path}':`, error);
  },
}));

// Start server with both HTTP and WebSocket support
server.listen(PORT, () => {
  console.log(`🚀 Backend server running on http://localhost:${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/`);
  console.log(`🔗 tRPC API: http://localhost:${PORT}/api/trpc`);
  console.log(`⚡ Socket.IO: ws://localhost:${PORT} (authenticated)`);
  console.log(`🔐 Authentication: JWT tokens in httpOnly cookies`);
});

export default app;

/**
 * AUTHENTICATION FLOW INTEGRATION:
 * 
 * 1. 🌐 HTTP API (tRPC):
 *    - Request includes JWT cookie
 *    - createContext extracts and validates token
 *    - ctx.user populated for authenticated requests
 *    - Protected procedures enforce authentication via middleware
 * 
 * 2. ⚡ WebSocket API (Socket.io):
 *    - Connection handshake includes JWT cookie
 *    - socketAuthMiddleware validates token before connection
 *    - socket.user populated with authenticated user data
 *    - All socket events have access to authenticated user
 * 
 * 3. 🔄 SHARED SECURITY MODEL:
 *    - Same JWT tokens work for both HTTP and WebSocket
 *    - Same cookie-based token storage
 *    - Consistent user authentication across protocols
 *    - Token expiration affects both API and real-time features
 * 
 * 4. 🏠 USER ROOMS:
 *    - Each user automatically joins personal room: `user_${userId}`
 *    - Thread rooms will be: `thread_${threadId}`
 *    - Enables targeted message broadcasting
 *    - Supports both direct messages and group chats
 * 
 * FRONTEND INTEGRATION:
 * ```tsx
 * // Login via tRPC sets JWT cookie
 * const login = trpc.auth.login.useMutation();
 * 
 * // Socket.io automatically uses same JWT cookie
 * const socket = io('http://localhost:4000', {
 *   withCredentials: true, // Include cookies
 * });
 * 
 * // Both are now authenticated with same user!
 * ```
 */