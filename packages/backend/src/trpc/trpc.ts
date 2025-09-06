import { initTRPC, TRPCError } from '@trpc/server';
import { type Context } from './context.js';
import { ZodError } from 'zod';

const t = initTRPC.context<Context>().create({
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        zodError: error.cause instanceof ZodError
          ? error.cause.flatten() 
          : null,
      },
    };
  },
});

export const router = t.router;
export const publicProcedure = t.procedure;

/**
 * Authentication Middleware for tRPC
 * 
 * This middleware ensures that only authenticated users can access protected procedures.
 * It validates the JWT token and attaches user information to the context.
 * 
 * HOW IT WORKS:
 * 1. Checks if user exists in context (populated by createContext)
 * 2. If user is null, throws UNAUTHORIZED error
 * 3. If user exists, proceeds with the request
 * 4. Extends context with guaranteed user object
 * 
 * USAGE:
 * ```ts
 * getUserProfile: protectedProcedure
 *   .query(({ ctx }) => {
 *     // ctx.user is guaranteed to exist and be typed!
 *     return ctx.user;
 *   })
 * ```
 */
const enforceUserIsAuthed = t.middleware(({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: 'You must be logged in to access this resource',
    });
  }

  return next({
    ctx: {
      // Infers that `user` is non-nullable
      ...ctx,
      user: ctx.user,
    },
  });
});

/**
 * Protected Procedure - Requires Authentication
 * 
 * Use this for any tRPC procedure that requires a logged-in user.
 * The middleware will automatically:
 * - Verify JWT token from cookies
 * - Populate ctx.user with authenticated user data
 * - Return UNAUTHORIZED error if token is invalid/missing
 * 
 * AUTHENTICATION FLOW:
 * Request → Cookies → JWT Token → Verify → User Context → Procedure
 * 
 * TYPE SAFETY BENEFITS:
 * - ctx.user is guaranteed to be non-null in protected procedures
 * - TypeScript provides full autocomplete for user properties
 * - No need for manual null checks in your business logic
 */
export const protectedProcedure = t.procedure.use(enforceUserIsAuthed);

