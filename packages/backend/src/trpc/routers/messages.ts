/**
 * Message Management Router - Handles individual message operations
 * 
 * This router manages sending and retrieving messages within conversation threads.
 * Messages are the individual chat entries that users send to each other.
 * 
 * KEY CONCEPTS:
 * - Message: Individual chat entry with content, sender, timestamp
 * - Thread Access Control: Users can only access messages from their threads
 * - Chronological Order: Messages displayed oldest-to-newest (chat convention)
 * - Real-time Ready: Structured for Socket.io message broadcasting
 * 
 * SECURITY MODEL:
 * - Users can only see messages from threads they participate in
 * - Users can only send messages to threads they participate in
 * - No direct message access by message ID (must go through thread)
 */

import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router, protectedProcedure } from '../trpc.js';

// Input validation schemas
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
    .trim(), // Remove leading/trailing whitespace
});

export const messagesRouter = router({
  /**
   * Get Thread Messages - Retrieve all messages in a conversation
   * 
   * BUSINESS LOGIC:
   * 1. Verify user has access to the thread (security check)
   * 2. Fetch all messages in chronological order
   * 3. Include sender information for each message
   * 4. Return formatted data for chat UI
   * 
   * SECURITY:
   * - Only returns messages from threads user participates in
   * - Prevents access to private conversations
   * - Uses thread participation as authorization
   */
  getThreadMessages: protectedProcedure
    .input(getThreadMessagesSchema)
    .query(async ({ input, ctx }) => {
      const { threadId } = input;
      const userId = ctx.user.id;

      console.log(`📖 Fetching messages for thread ${threadId} by user: ${ctx.user.username}`);

      // Step 1: Verify user has access to this thread
      // This is a critical security check - users can only see messages 
      // from threads they participate in
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

      // Step 2: Fetch all messages in the thread
      const messages = await ctx.prisma.message.findMany({
        where: {
          threadId: threadId
        },
        include: {
          sender: {
            select: {
              id: true,
              username: true,
            }
          }
        },
        orderBy: {
          createdAt: 'asc' // Oldest first (standard chat order)
        }
      });

      console.log(`✅ Found ${messages.length} messages in thread ${threadId}`);

      // Step 3: Format data for frontend
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

  /**
   * Send Message - Add new message to a conversation
   * 
   * BUSINESS LOGIC:
   * 1. Verify user has access to the thread (security)
   * 2. Create new message with current user as sender
   * 3. Update thread's updatedAt timestamp (for thread sorting)
   * 4. Return the new message data (for real-time broadcasting)
   * 
   * REAL-TIME INTEGRATION:
   * - Returns complete message data for Socket.io broadcasting
   * - Updates thread timestamp for proper ordering in thread list
   * - Structured to match getThreadMessages format
   */
  sendMessage: protectedProcedure
    .input(sendMessageSchema)
    .mutation(async ({ input, ctx }) => {
      const { threadId, content } = input;
      const userId = ctx.user.id;

      console.log(`💬 Sending message to thread ${threadId} from: ${ctx.user.username}`);
      console.log(`📝 Content: "${content.substring(0, 50)}${content.length > 50 ? '...' : ''}"`);

      // Step 1: Verify user has access to this thread
      // Same security check as getThreadMessages
      const threadAccess = await ctx.prisma.threadParticipant.findUnique({
        where: {
          threadId_userId: {
            threadId: threadId,
            userId: userId,
          }
        },
        include: {
          thread: true // We'll need thread info for updating timestamp
        }
      });

      if (!threadAccess) {
        console.log(`❌ Send denied: User ${ctx.user.username} not in thread ${threadId}`);
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'You cannot send messages to this thread',
        });
      }

      // Step 2: Create the message and update thread timestamp in a transaction
      // Using a transaction ensures data consistency
      const result = await ctx.prisma.$transaction(async (tx) => {
        // Create the new message
        const newMessage = await tx.message.create({
          data: {
            content: content,
            senderId: userId,
            threadId: threadId,
          },
          include: {
            sender: {
              select: {
                id: true,
                username: true,
              }
            }
          }
        });

        // Update thread timestamp for proper sorting in getUserThreads
        await tx.thread.update({
          where: { id: threadId },
          data: { updatedAt: new Date() }
        });

        return newMessage;
      });

      console.log(`✅ Message ${result.id} sent successfully to thread ${threadId}`);

      // Step 3: Return formatted message data
      // This matches the format from getThreadMessages for consistency
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

/**
 * ARCHITECTURE NOTES:
 * 
 * 1. 🔐 SECURITY MODEL:
 *    - Thread participation = message access authorization
 *    - No direct message ID access (prevents data leaks)
 *    - All operations verified through thread membership
 * 
 * 2. 📊 DATA CONSISTENCY:
 *    - Database transactions for multi-table operations
 *    - Thread timestamp updates for proper ordering
 *    - Consistent data formatting across endpoints
 * 
 * 3. 🚀 REAL-TIME READY:
 *    - sendMessage returns complete message data
 *    - Perfect format for Socket.io broadcasting
 *    - Includes sender info and user context flags
 * 
 * 4. 🎯 PERFORMANCE:
 *    - Efficient queries with proper includes
 *    - Single transaction for consistency
 *    - Minimal data transfer (only needed fields)
 * 
 * 5. 🧠 USER EXPERIENCE:
 *    - Messages in chronological order (chat convention)
 *    - isFromCurrentUser flag for UI styling
 *    - Input validation prevents empty/oversized messages
 * 
 * INTEGRATION WITH THREADS:
 * - Thread router: Manages conversations
 * - Message router: Manages individual chat entries
 * - Together: Complete messaging system
 * 
 * NEXT STEPS:
 * - Add to main router configuration
 * - Test endpoints with Postman
 * - Integrate with real-time Socket.io (Phase 4)
 * - Build frontend chat UI (Phase 5)
 */