import { Socket } from 'socket.io';
import { extractTokenFromCookies, verifyToken } from '../utils/jwt.js';
import type { AuthUser } from '@shared/types.js';

export interface AuthenticatedSocket extends Socket {
  user: AuthUser;
}

export const socketAuthMiddleware = (socket: Socket, next: (err?: Error) => void) => {
  try {
    // Try auth.token first, fallback to cookies for flexibility
    let token = socket.handshake.auth?.token;
    if (!token) {
      const cookies = parseCookieString(socket.handshake.headers.cookie || '');
      token = extractTokenFromCookies(cookies);
    }
    
    if (!token) {
      console.warn('🚫 WebSocket connection rejected: No auth token');
      return next(new Error('Authentication required'));
    }

    const user = verifyToken(token);
    if (!user) {
      console.warn('🚫 WebSocket connection rejected: Invalid token');
      return next(new Error('Invalid authentication token'));
    }

    (socket as AuthenticatedSocket).user = user;
    console.log(`✅ WebSocket authenticated: ${user.username} (ID: ${user.id})`);
    next();

  } catch (error) {
    console.error('❌ Socket authentication error:', error);
    next(new Error('Authentication failed'));
  }
};

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