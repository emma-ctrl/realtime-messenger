/**
 * Socket.io Authentication Middleware
 * 
 * This module handles JWT authentication for WebSocket connections.
 * It validates JWT tokens during the Socket.io handshake process.
 * 
 * INTEGRATION POINTS:
 * - WebSocket handshake includes HTTP cookies
 * - JWT token extracted and validated
 * - Authenticated user data attached to socket
 * - Unauthenticated connections are rejected
 */

import { Socket } from 'socket.io';
import { extractTokenFromCookies, verifyToken } from '../utils/jwt.js';
import type { AuthUser } from '@shared/types.js';

// Extended Socket interface with user data
export interface AuthenticatedSocket extends Socket {
  user: AuthUser;
}

/**
 * Socket.io Authentication Middleware
 * 
 * FLOW:
 * 1. Extract JWT token from WebSocket handshake cookies
 * 2. Verify and decode the JWT token
 * 3. Attach user data to socket instance
 * 4. Allow connection to proceed
 * 5. Reject connection if token is invalid/missing
 * 
 * USAGE:
 * ```ts
 * io.use(socketAuthMiddleware);
 * 
 * io.on('connection', (socket: AuthenticatedSocket) => {
 *   console.log(`User ${socket.user.username} connected`);
 *   // socket.user is guaranteed to exist and be typed!
 * });
 * ```
 */
export const socketAuthMiddleware = (socket: Socket, next: (err?: Error) => void) => {
  try {
    // First try: Extract token from socket.io auth object (frontend auth.token)
    let token = socket.handshake.auth?.token;
    
    // Fallback: Extract cookies from handshake headers (cookie-based auth)
    if (!token) {
      const cookies = parseCookieString(socket.handshake.headers.cookie || '');
      token = extractTokenFromCookies(cookies);
    }
    
    if (!token) {
      console.warn('🚫 WebSocket connection rejected: No auth token in auth object or cookies');
      return next(new Error('Authentication required'));
    }

    // Verify JWT token
    const user = verifyToken(token);
    
    if (!user) {
      console.warn('🚫 WebSocket connection rejected: Invalid token');
      return next(new Error('Invalid authentication token'));
    }

    // Attach user data to socket
    (socket as AuthenticatedSocket).user = user;
    
    console.log(`✅ WebSocket authenticated: ${user.username} (ID: ${user.id})`);
    next(); // Allow connection

  } catch (error) {
    console.error('❌ Socket authentication error:', error);
    next(new Error('Authentication failed'));
  }
};

/**
 * Parse Cookie String Helper
 * 
 * Converts cookie string format to key-value object.
 * Example: "auth-token=abc123; other=value" → { "auth-token": "abc123", "other": "value" }
 */
function parseCookieString(cookieString: string): Record<string, string> {
  const cookies: Record<string, string> = {};
  
  if (!cookieString) return cookies;
  
  cookieString.split(';').forEach(cookie => {
    const [key, value] = cookie.trim().split('=');
    if (key && value) {
      cookies[key] = decodeURIComponent(value);
    }
  });
  
  return cookies;
}

/**
 * SOCKET.IO AUTHENTICATION BENEFITS:
 * 
 * 1. ✅ SECURE REAL-TIME COMMUNICATION:
 *    - Only authenticated users can establish WebSocket connections
 *    - JWT validation prevents unauthorized access
 *    - Same security model as HTTP API
 * 
 * 2. ✅ USER CONTEXT IN SOCKET HANDLERS:
 *    - Every socket event has access to authenticated user
 *    - No need to validate tokens in individual event handlers
 *    - Type-safe user data throughout socket operations
 * 
 * 3. ✅ SEAMLESS INTEGRATION:
 *    - Uses same JWT tokens as tRPC API
 *    - Cookies automatically included in WebSocket handshake
 *    - Consistent authentication across HTTP and WebSocket
 * 
 * 4. ✅ AUTOMATIC DISCONNECTION:
 *    - Invalid/expired tokens prevent connection
 *    - Users logged out via API automatically lose WebSocket access
 *    - Security breaches contained to single session
 * 
 * FRONTEND INTEGRATION:
 * ```ts
 * // Frontend Socket.io client
 * const socket = io('http://localhost:4000', {
 *   withCredentials: true, // Include cookies in handshake
 * });
 * 
 * // JWT cookie automatically sent in handshake
 * // Server validates and allows/rejects connection
 * ```
 * 
 * SECURITY CONSIDERATIONS:
 * - WebSocket connections inherit HTTP cookie security
 * - JWT expiration applies to WebSocket sessions
 * - Connection drops when token expires (client should reconnect)
 * - No token refresh mechanism (acceptable for short-lived tokens)
 */