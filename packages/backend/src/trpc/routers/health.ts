import { z } from 'zod';
import { router, publicProcedure } from '../trpc.js';

export const healthRouter = router({
  check: publicProcedure
    .query(async ({ ctx }) => {
      await ctx.prisma.$queryRaw`SELECT 1`;
      
      return {
        message: 'API is healthy',
        timestamp: new Date().toISOString(),
        database: 'connected'
      };
    }),

  greet: publicProcedure
    .input(z.object({
      name: z.string().min(1, 'Name cannot be empty'),
    }))
    .query(({ input }) => {
      return {
        greeting: `Hello, ${input.name}!`,
        receivedName: input.name,
      };
    }),

  getUserCount: publicProcedure
    .query(async ({ ctx }) => {
      const count = await ctx.prisma.user.count();
      
      return {
        userCount: count,
        message: `There are ${count} users in the database`
      };
    }),

});

