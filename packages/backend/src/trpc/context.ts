import { type CreateExpressContextOptions } from '@trpc/server/adapters/express';
import { PrismaClient } from '@prisma/client';
import { Server as SocketIOServer } from 'socket.io';
import { extractTokenFromCookies, verifyToken } from '../utils/jwt.js';
import type { AuthUser } from '@shared/types.js';

const prisma = new PrismaClient();

export const createContext = ({ req, res }: CreateExpressContextOptions, io?: SocketIOServer) => {
  let user: AuthUser | null = null;

  // Extract JWT token from cookies or Authorization header
  let token = extractTokenFromCookies(req.cookies);
  
  // Fallback to Authorization header for development
  if (!token && req.headers.authorization) {
    const authHeader = req.headers.authorization;
    if (authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    }
  }
  
  if (token) {
    // Verify and decode the JWT token
    user = verifyToken(token);
    
    if (user) {
      console.log(`✅ Authenticated request from user: ${user.username} (ID: ${user.id})`);
    } else {
      console.warn('⚠️  Invalid JWT token in request cookies');
    }
  }
  
  return {
    prisma,
    req,
    res,
    user, // null for public requests, AuthUser object for authenticated requests
    io, // Socket.io server for real-time broadcasting
  };
};

export type Context = Awaited<ReturnType<typeof createContext>>;

