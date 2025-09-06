import { type CreateExpressContextOptions } from '@trpc/server/adapters/express';
import { PrismaClient } from '@prisma/client';
import { Server as SocketIOServer } from 'socket.io';
import { extractTokenFromCookies, verifyToken } from '../utils/jwt.js';
import type { AuthUser } from '@shared/types.js';

const prisma = new PrismaClient();

/**
 * tRPC Context Creation - The Heart of Authentication & Real-time
 * 
 * This function runs for EVERY tRPC request and is responsible for:
 * 1. Extracting JWT token from HTTP cookies
 * 2. Verifying and decoding the token
 * 3. Populating user context for authenticated requests
 * 4. Providing database access and HTTP objects
 * 5. Providing Socket.io server for real-time broadcasting
 * 
 * AUTHENTICATION FLOW:
 * Every Request → createContext → Extract Cookie → Verify JWT → Set User
 * 
 * CONTEXT USAGE:
 * - ctx.user: Authenticated user data (null if not logged in)
 * - ctx.prisma: Database client for all operations
 * - ctx.req: Express request object (for headers, etc.)
 * - ctx.res: Express response object (for setting cookies, etc.)
 * - ctx.io: Socket.io server for real-time messaging
 */
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

/**
 * CONTEXT BENEFITS:
 * 
 * 1. ✅ AUTOMATIC AUTHENTICATION:
 *    - Every request automatically checks for valid JWT
 *    - No need to manually verify tokens in procedures
 *    - Clean separation between auth logic and business logic
 * 
 * 2. ✅ TYPE SAFETY:
 *    - ctx.user is properly typed as AuthUser | null
 *    - Protected procedures get non-null user via middleware
 *    - Compile-time checking prevents auth bugs
 * 
 * 3. ✅ PERFORMANCE:
 *    - JWT verification happens once per request
 *    - No database queries for every auth check
 *    - Stateless authentication scales well
 * 
 * 4. ✅ FLEXIBILITY:
 *    - Public procedures work with ctx.user = null
 *    - Protected procedures get guaranteed authenticated user
 *    - Mixed procedures can handle both cases
 * 
 * EXAMPLE PROCEDURE USAGE:
 * 
 * ```ts
 * // Public procedure - user might be null
 * getPublicThreads: publicProcedure
 *   .query(({ ctx }) => {
 *     if (ctx.user) {
 *       // Show user's threads
 *     } else {
 *       // Show public threads only
 *     }
 *   }),
 * 
 * // Protected procedure - user guaranteed to exist
 * createThread: protectedProcedure
 *   .input(createThreadSchema)
 *   .mutation(({ ctx, input }) => {
 *     // ctx.user is guaranteed to be non-null here!
 *     return ctx.prisma.thread.create({
 *       data: { createdBy: ctx.user.id, ...input }
 *     });
 *   })
 * ```
 */

