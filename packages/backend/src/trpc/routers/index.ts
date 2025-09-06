import { router } from '../trpc.js';
import { healthRouter } from './health.js';
import { authRouter } from './auth.js';
import { threadsRouter } from './threads.js';
import { messagesRouter } from './messages.js';

/**
 * Application Router - The Root of Your API
 * 
 * This combines all your feature routers into one main router.
 * Each sub-router maintains its own type safety while being combined.
 */
export const appRouter = router({
  // Health check endpoints
  health: healthRouter,
  
  // Authentication endpoints
  auth: authRouter,
  
  // Thread management endpoints
  threads: threadsRouter, // Thread operations
  
  // Message management endpoints
  messages: messagesRouter, // Message CRUD operations
  
  // TODO: Add more routers as we build features
  // users: userRouter,     // User management  
});

/**
 * CRITICAL TYPE EXPORT - This enables frontend type safety!
 * 
 * This type represents the entire API surface area.
 * The frontend will import this type to get full type safety.
 */
export type AppRouter = typeof appRouter;

/**
 * TYPE SAFETY EXPLANATION:
 * 
 * 1. appRouter contains all your API procedures
 * 2. `typeof appRouter` extracts the TypeScript type  
 * 3. Frontend imports AppRouter type
 * 4. tRPC client uses this type for full type inference
 * 5. Every API call is now fully typed end-to-end!
 * 
 * FRONTEND SETUP PREVIEW:
 * ```ts
 * // Frontend: utils/trpc.ts
 * import type { AppRouter } from '../../../backend/src/trpc/routers';
 * 
 * export const trpc = createTRPCReact<AppRouter>();
 * //                                 ^ This provides ALL the type safety!
 * ```
 * 
 * The magic happens because:
 * - TypeScript can analyze the entire router structure
 * - Extract input/output types for every procedure
 * - Provide autocomplete and error checking
 * - All without any code generation or build steps!
 */