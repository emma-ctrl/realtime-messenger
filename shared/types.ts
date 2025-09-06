/**
 * Shared Types - The Foundation of Type Safety
 * 
 * These types are shared between frontend and backend,
 * ensuring consistency across your entire application.
 * 
 * tRPC automatically uses these types for validation and inference.
 */

// Re-export Prisma generated types for convenience
export type { User, Thread, ThreadParticipant, Message } from '@prisma/client';

/**
 * API Response Types - Standardized response formats
 */
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

/**
 * Authentication Types
 */
export interface AuthUser {
  id: number;
  username: string;
  // Don't include password hash in client-facing types!
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  user: AuthUser;
  token?: string; // JWT token (if not using httpOnly cookies)
}

/**
 * Thread Types - For messaging functionality
 */
export interface ThreadWithParticipants {
  id: number;
  createdAt: Date;
  updatedAt: Date;
  participants: Array<{
    user: {
      id: number;
      username: string;
    };
    joinedAt: Date;
  }>;
  // Optional: last message preview
  lastMessage?: {
    id: number;
    content: string;
    createdAt: Date;
    sender: {
      id: number;
      username: string;
    };
  };
}

/**
 * Message Types - For chat functionality  
 */
export interface MessageWithSender {
  id: number;
  content: string;
  createdAt: Date;
  threadId: number;
  sender: {
    id: number;
    username: string;
  };
}

/**
 * Real-time Event Types - For Socket.io
 */
export interface NewMessageEvent {
  type: 'NEW_MESSAGE';
  data: MessageWithSender;
}

export interface UserJoinedEvent {
  type: 'USER_JOINED';
  data: {
    threadId: number;
    user: AuthUser;
  };
}

export type SocketEvent = NewMessageEvent | UserJoinedEvent;

/**
 * TYPE SAFETY BENEFITS:
 * 
 * 1. ✅ Single source of truth - change a type once, update everywhere
 * 2. ✅ Compile-time checks - TypeScript catches mismatches immediately  
 * 3. ✅ IDE support - autocomplete works across frontend and backend
 * 4. ✅ Refactor safety - rename fields with confidence
 * 5. ✅ Documentation - types serve as living documentation
 * 
 * USAGE EXAMPLE:
 * 
 * Backend:
 * ```ts
 * // Procedure automatically gets typed parameters and return value
 * getThread: publicProcedure
 *   .input(z.object({ id: z.number() }))
 *   .query(async ({ ctx, input }): Promise<ThreadWithParticipants> => {
 *     // Return type is enforced by TypeScript
 *     return await ctx.prisma.thread.findUnique(...)
 *   })
 * ```
 * 
 * Frontend:
 * ```tsx  
 * // Hook is automatically typed based on backend procedure
 * const { data: thread } = trpc.threads.getThread.useQuery({ id: 1 });
 * //      ^ TypeScript knows this is ThreadWithParticipants | undefined
 * 
 * return <div>{thread?.participants[0]?.user.username}</div>
 * //                                       ^ Autocomplete works!
 * ```
 */