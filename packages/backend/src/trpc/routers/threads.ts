import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router, protectedProcedure } from '../trpc.js';

const createThreadSchema = z.object({
  targetUsername: z.string()
    .min(1, 'Username is required')
    .max(50, 'Username must be 50 characters or less'),
});

export const threadsRouter = router({
  getUserThreads: protectedProcedure
    .query(async ({ ctx }) => {
      const userId = ctx.user.id;
      console.log(`📋 Fetching threads for user: ${ctx.user.username} (ID: ${userId})`);

      const threads = await ctx.prisma.thread.findMany({
        where: {
          participants: {
            some: { userId: userId }
          },
          messages: {
            some: {} // Only return threads that have messages
          }
        },
        include: {
          participants: {
            include: {
              user: {
                select: { id: true, username: true }
              }
            }
          },
          messages: {
            take: 1,
            orderBy: { createdAt: 'desc' },
            include: {
              sender: {
                select: { id: true, username: true }
              }
            }
          }
        },
        orderBy: { updatedAt: 'desc' }
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

  createThread: protectedProcedure
    .input(createThreadSchema)
    .mutation(async ({ input, ctx }) => {
      const { targetUsername } = input;
      const currentUserId = ctx.user.id;
      console.log(`💬 Creating thread: ${ctx.user.username} → ${targetUsername}`);

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

      if (targetUser.id === currentUserId) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Cannot create thread with yourself',
        });
      }

      // Check if thread already exists to prevent duplicates
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

