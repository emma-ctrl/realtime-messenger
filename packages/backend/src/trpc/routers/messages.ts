import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router, protectedProcedure } from '../trpc.js';

const getThreadMessagesSchema = z.object({
  threadId: z.number()
    .int('Thread ID must be an integer')
    .positive('Thread ID must be positive'),
});

const sendMessageSchema = z.object({
  threadId: z.number()
    .int('Thread ID must be an integer') 
    .positive('Thread ID must be positive'),
  content: z.string()
    .min(1, 'Message content cannot be empty')
    .max(2000, 'Message content must be 2000 characters or less')
    .trim(),
});

export const messagesRouter = router({
  getThreadMessages: protectedProcedure
    .input(getThreadMessagesSchema)
    .query(async ({ input, ctx }) => {
      const { threadId } = input;
      const userId = ctx.user.id;
      console.log(`📖 Fetching messages for thread ${threadId} by user: ${ctx.user.username}`);

      // Verify user has access to this thread
      const threadAccess = await ctx.prisma.threadParticipant.findUnique({
        where: {
          threadId_userId: {
            threadId: threadId,
            userId: userId,
          }
        }
      });

      if (!threadAccess) {
        console.log(`❌ Access denied: User ${ctx.user.username} not in thread ${threadId}`);
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'You do not have access to this thread',
        });
      }

      const messages = await ctx.prisma.message.findMany({
        where: { threadId: threadId },
        include: {
          sender: {
            select: { id: true, username: true }
          }
        },
        orderBy: { createdAt: 'asc' }
      });

      console.log(`✅ Found ${messages.length} messages in thread ${threadId}`);
      const formattedMessages = messages.map(message => ({
        id: message.id,
        content: message.content,
        createdAt: message.createdAt,
        sender: {
          id: message.sender.id,
          username: message.sender.username,
        },
        // Helpful for UI to know if current user sent this message
        isFromCurrentUser: message.sender.id === userId,
      }));

      return {
        threadId,
        messages: formattedMessages,
        totalCount: messages.length,
      };
    }),

  sendMessage: protectedProcedure
    .input(sendMessageSchema)
    .mutation(async ({ input, ctx }) => {
      const { threadId, content } = input;
      const userId = ctx.user.id;
      console.log(`💬 Sending message to thread ${threadId} from: ${ctx.user.username}`);
      console.log(`📝 Content: "${content.substring(0, 50)}${content.length > 50 ? '...' : ''}"`);

      const threadAccess = await ctx.prisma.threadParticipant.findUnique({
        where: {
          threadId_userId: {
            threadId: threadId,
            userId: userId,
          }
        },
        include: { thread: true }
      });

      if (!threadAccess) {
        console.log(`❌ Send denied: User ${ctx.user.username} not in thread ${threadId}`);
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'You cannot send messages to this thread',
        });
      }

      // Create message and update thread timestamp atomically
      const result = await ctx.prisma.$transaction(async (tx) => {
        const newMessage = await tx.message.create({
          data: {
            content: content,
            senderId: userId,
            threadId: threadId,
          },
          include: {
            sender: {
              select: { id: true, username: true }
            }
          }
        });

        await tx.thread.update({
          where: { id: threadId },
          data: { updatedAt: new Date() }
        });

        return newMessage;
      });

      console.log(`✅ Message ${result.id} sent successfully to thread ${threadId}`);
      const formattedMessage = {
        id: result.id,
        content: result.content,
        createdAt: result.createdAt,
        sender: {
          id: result.sender.id,
          username: result.sender.username,
        },
        isFromCurrentUser: true, // Always true for newly sent messages
        threadId: threadId,
      };

      // Step 4: REAL-TIME BROADCASTING! 
      // Now automatically broadcast this message to all users in the thread
      if (ctx.io) {
        const roomName = `thread_${threadId}`;
        
        console.log(`📢 Auto-broadcasting message to room: ${roomName}`);
        
        // Send to all OTHER users in the thread (sender already has the message)
        ctx.io.to(roomName).emit('new_message', {
          threadId: threadId,
          message: {
            ...formattedMessage,
            isFromCurrentUser: false, // For other users, this is NOT their message
          }
        });
        
        console.log(`✅ Real-time broadcast complete!`);
      } else {
        console.warn('⚠️  Socket.io not available for broadcasting');
      }

      // This data structure is perfect for real-time broadcasting:
      // Socket.io can send this exact object to all thread participants
      return formattedMessage;
    }),
});

