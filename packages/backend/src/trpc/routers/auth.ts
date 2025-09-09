import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { TRPCError } from '@trpc/server';
import { publicProcedure, protectedProcedure, router } from '../trpc.js';
import { generateToken, JWT_COOKIE_OPTIONS } from '../../utils/jwt.js';
import type { LoginResponse, AuthUser } from '@shared/types.js';

const loginSchema = z.object({
  username: z.string()
    .min(1, 'Username is required')
    .max(50, 'Username must be 50 characters or less'),
  password: z.string()
    .min(1, 'Password is required')
    .max(255, 'Password is too long'),
});

export const authRouter = router({
  login: publicProcedure
    .input(loginSchema)
    .mutation(async ({ input, ctx }): Promise<LoginResponse> => {
      const { username, password } = input;
      console.log(`🔐 Login attempt for username: ${username}`);

      const user = await ctx.prisma.user.findUnique({
        where: { username },
        select: {
          id: true,
          username: true,
          password: true,
        },
      });
      
      if (!user) {
        console.log(`❌ Login failed: User '${username}' not found`);
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'Invalid username or password',
        });
      }

      // Verify password with bcrypt
      const isValidPassword = await bcrypt.compare(password, user.password);
      
      if (!isValidPassword) {
        console.log(`❌ Login failed: Invalid password for '${username}'`);
        throw new TRPCError({
          code: 'UNAUTHORIZED', 
          message: 'Invalid username or password',
        });
      }

      // Create user object (without password hash)
      const authUser: AuthUser = {
        id: user.id,
        username: user.username,
      };

      // Generate JWT token
      const token = generateToken(authUser);

      // Set httpOnly cookie (secure, XSS-proof)
      ctx.res.cookie('auth-token', token, JWT_COOKIE_OPTIONS);

      console.log(`✅ Login successful for '${username}' (ID: ${user.id})`);

      return {
        user: authUser,
        token, // Include token in response for development
      };
    }),

  /**
   * Logout Procedure - Clear Authentication
   * 
   * FLOW:
   * 1. Clear the JWT cookie
   * 2. Return success message
   * 
   * NOTES:
   * - No database operations needed (JWT is stateless)
   * - Client will lose access immediately
   * - Token remains valid until expiration (acceptable for short-lived tokens)
   */
  logout: publicProcedure
    .mutation(({ ctx }) => {
      // Clear the auth cookie
      ctx.res.clearCookie('auth-token', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        path: '/',
      });

      console.log('✅ User logged out successfully');

      return {
        success: true,
        message: 'Logged out successfully',
      };
    }),

  /**
   * Get Current User Procedure - Protected Route
   * 
   * FLOW:
   * 1. Middleware validates JWT and populates ctx.user
   * 2. Return authenticated user data
   * 
   * USAGE:
   * - Frontend can check authentication status
   * - Get current user info for UI
   * - Verify token is still valid
   */
  getCurrentUser: protectedProcedure
    .query(({ ctx }): AuthUser => {
      // ctx.user is guaranteed to exist due to protectedProcedure middleware
      console.log(`📋 Profile requested for user: ${ctx.user.username}`);
      return ctx.user;
    }),

  /**
   * Check Authentication Status - Public Route
   * 
   * FLOW:
   * 1. Check if ctx.user exists (JWT was valid)
   * 2. Return authentication status and user data
   * 
   * USAGE:
   * - Frontend initial load to check auth state
   * - Handle expired tokens gracefully
   * - No error thrown if not authenticated
   */
  checkAuth: publicProcedure
    .query(({ ctx }) => {
      if (ctx.user) {
        console.log(`✅ Auth check passed for user: ${ctx.user.username}`);
        return {
          isAuthenticated: true,
          user: ctx.user,
        };
      } else {
        console.log('ℹ️  Auth check: No valid token found');
        return {
          isAuthenticated: false,
          user: null,
        };
      }
    }),
});

/**
 * DATABASE VS HARDCODED USERS:
 * 
 * ✅ USING DATABASE (Current Implementation):
 * - Consistent with existing seed script
 * - Scalable for future user management
 * - Supports password updates
 * - More realistic production setup
 * 
 * ❌ HARDCODED ARRAY (Alternative):
 * - Simpler for demo purposes
 * - No database dependency
 * - But inconsistent with existing architecture
 * 
 * SETUP INSTRUCTIONS:
 * 1. Run: npm run db:seed
 * 2. Available users: alice, bob, charlie (password: password123)
 * 3. Database contains hashed passwords for security
 * 
 * AUTHENTICATION INTEGRATION POINTS:
 * 
 * 1. FRONTEND LOGIN:
 * ```tsx
 * const loginMutation = trpc.auth.login.useMutation({
 *   onSuccess: (data) => {
 *     // User is now authenticated
 *     // JWT cookie is set automatically
 *     router.push('/chat');
 *   }
 * });
 * ```
 * 
 * 2. PROTECTED API CALLS:
 * ```tsx
 * const { data: threads } = trpc.threads.getUserThreads.useQuery();
 * // This will automatically include JWT cookie
 * // Backend validates token in middleware
 * ```
 * 
 * 3. SOCKET.IO AUTHENTICATION:
 * - JWT cookie is automatically sent in WebSocket handshake
 * - Server validates token during connection
 * - User joins authenticated rooms
 * 
 * 4. LOGOUT FLOW:
 * ```tsx
 * const logoutMutation = trpc.auth.logout.useMutation({
 *   onSuccess: () => {
 *     // Cookie is cleared
 *     // Redirect to login
 *     router.push('/login');
 *   }
 * });
 * ```
 */