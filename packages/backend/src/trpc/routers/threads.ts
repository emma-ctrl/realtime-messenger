/**
 * Thread Management Router - Handles conversation operations
 * 
 * This router manages the creation and retrieval of conversation threads.
 * In our messaging app, a "thread" represents a conversation between users.
 * 
 * KEY CONCEPTS:
 * - Thread: A conversation container (like a chat room)
 * - Participants: Users who are part of the conversation
 * - DM (Direct Message): A thread with exactly 2 participants
 * 
 * DATABASE RELATIONSHIPS:
 * User ←→ ThreadParticipants ←→ Thread ←→ Messages
 *  1:N         N:N             1:N       1:N
 */

import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router, protectedProcedure } from '../trpc.js';

// Input validation schemas
const createThreadSchema = z.object({
  targetUsername: z.string()
    .min(1, 'Username is required')
    .max(50, 'Username must be 50 characters or less'),
});

export const threadsRouter = router({
  /**
   * Get User Threads - Retrieve all conversations for current user
   * 
   * BUSINESS LOGIC:
   * 1. Find all threads where current user is a participant
   * 2. Include other participant information (for DMs)
   * 3. Include last message preview
   * 4. Order by most recent activity
   * 
   * SECURITY:
   * - Only returns threads user has access to (via participant relationship)
   * - Uses protectedProcedure to ensure user is authenticated
   */
  getUserThreads: protectedProcedure
    .query(async ({ ctx }) => {
      const userId = ctx.user.id;
      
      console.log(`📋 Fetching threads for user: ${ctx.user.username} (ID: ${userId})`);

      const threads = await ctx.prisma.thread.findMany({
        where: {
          participants: {
            some: {
              userId: userId // Find threads where current user is a participant
            }
          }
        },
        include: {
          participants: {
            include: {
              user: {
                select: {
                  id: true,
                  username: true,
                }
              }
            }
          },
          messages: {
            take: 1, // Get only the last message
            orderBy: {
              createdAt: 'desc'
            },
            include: {
              sender: {
                select: {
                  id: true,
                  username: true,
                }
              }
            }
          }
        },
        orderBy: {
          updatedAt: 'desc' // Most recently active threads first
        }
      });

      // Transform the data for frontend consumption
      const threadsWithMetadata = threads.map(thread => {
        // For DMs, find the "other" participant (not current user)
        const otherParticipant = thread.participants.find(
          p => p.user.id !== userId
        )?.user;

        const lastMessage = thread.messages[0] || null;

        return {
          id: thread.id,
          createdAt: thread.createdAt,
          updatedAt: thread.updatedAt,
          
          // For DMs, we show the other participant's name as thread title
          otherParticipant,
          
          // Last message preview for thread list
          lastMessage: lastMessage ? {
            id: lastMessage.id,
            content: lastMessage.content,
            createdAt: lastMessage.createdAt,
            sender: lastMessage.sender,
          } : null,
          
          // All participants (useful for future group chat support)
          participants: thread.participants.map(p => ({
            userId: p.user.id,
            username: p.user.username,
          })),
        };
      });

      console.log(`✅ Found ${threadsWithMetadata.length} threads for ${ctx.user.username}`);
      
      return threadsWithMetadata;
    }),

  /**
   * Create Thread - Start new conversation with another user
   * 
   * BUSINESS LOGIC:
   * 1. Validate target user exists
   * 2. Check if thread already exists between these users
   * 3. If not, create new thread and add both users as participants
   * 4. Return the new thread data
   * 
   * DUPLICATE PREVENTION:
   * - For DMs, we prevent multiple threads between same 2 users
   * - This keeps the UX clean (one conversation per user pair)
   */
  createThread: protectedProcedure
    .input(createThreadSchema)
    .mutation(async ({ input, ctx }) => {
      const { targetUsername } = input;
      const currentUserId = ctx.user.id;

      console.log(`💬 Creating thread: ${ctx.user.username} → ${targetUsername}`);

      // Step 1: Validate target user exists
      const targetUser = await ctx.prisma.user.findUnique({
        where: { username: targetUsername },
        select: { id: true, username: true }
      });

      if (!targetUser) {
        console.log(`❌ Target user not found: ${targetUsername}`);
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: `User '${targetUsername}' not found`,
        });
      }

      // Step 2: Prevent user from creating thread with themselves
      if (targetUser.id === currentUserId) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Cannot create thread with yourself',
        });
      }

      // Step 3: Check if thread already exists between these users
      const existingThread = await ctx.prisma.thread.findFirst({
        where: {
          AND: [
            {
              participants: {
                some: { userId: currentUserId }
              }
            },
            {
              participants: {
                some: { userId: targetUser.id }
              }
            },
            {
              participants: {
                // Ensure it's exactly 2 participants (DM only)
                // This prevents matching group chats that include both users
                every: {
                  userId: { in: [currentUserId, targetUser.id] }
                }
              }
            }
          ]
        },
        include: {
          participants: {
            include: {
              user: {
                select: { id: true, username: true }
              }
            }
          }
        }
      });

      if (existingThread) {
        console.log(`ℹ️  Thread already exists between ${ctx.user.username} and ${targetUsername}`);
        
        // Return existing thread in same format as new thread
        const otherParticipant = existingThread.participants.find(
          p => p.user.id !== currentUserId
        )?.user;

        return {
          id: existingThread.id,
          createdAt: existingThread.createdAt,
          updatedAt: existingThread.updatedAt,
          otherParticipant,
          lastMessage: null, // No messages yet or fetch separately
          participants: existingThread.participants.map(p => ({
            userId: p.user.id,
            username: p.user.username,
          })),
        };
      }

      // Step 4: Create new thread with both participants
      const newThread = await ctx.prisma.thread.create({
        data: {
          participants: {
            create: [
              { userId: currentUserId },
              { userId: targetUser.id },
            ]
          }
        },
        include: {
          participants: {
            include: {
              user: {
                select: { id: true, username: true }
              }
            }
          }
        }
      });

      console.log(`✅ Created new thread ${newThread.id}: ${ctx.user.username} ↔ ${targetUsername}`);

      // Return in same format as getUserThreads
      return {
        id: newThread.id,
        createdAt: newThread.createdAt,
        updatedAt: newThread.updatedAt,
        otherParticipant: targetUser,
        lastMessage: null,
        participants: newThread.participants.map(p => ({
          userId: p.user.id,
          username: p.user.username,
        })),
      };
    }),
});

/**
 * ARCHITECTURE NOTES:
 * 
 * 1. 🔐 SECURITY:
 *    - All procedures use protectedProcedure (authentication required)
 *    - Users can only see threads they participate in
 *    - Input validation with Zod schemas
 * 
 * 2. 📊 DATA MODELING:
 *    - Threads are containers for conversations
 *    - ThreadParticipants creates many-to-many relationship
 *    - This design scales to group chats (3+ participants)
 * 
 * 3. 🎯 BUSINESS LOGIC:
 *    - Duplicate prevention for DMs
 *    - Last message preview for thread list
 *    - Sorted by most recent activity
 * 
 * 4. 🚀 PERFORMANCE:
 *    - Efficient Prisma queries with includes
 *    - Minimal data transfer (only needed fields)
 *    - Database-level ordering and filtering
 * 
 * NEXT STEPS:
 * - Add this router to main router configuration
 * - Create message router for sending/receiving messages
 * - Add real-time updates via Socket.io
 */