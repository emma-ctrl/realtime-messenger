import { createTRPCProxyClient, httpBatchLink } from '@trpc/client';
import type { AppRouter } from '../../../backend/src/trpc/routers';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

export const trpcClient = createTRPCProxyClient<AppRouter>({
  links: [
    httpBatchLink({
      url: `${API_URL}/api/trpc`,
      fetch(url, options) {
        return fetch(url, {
          ...options,
          credentials: 'include', // Include cookies for JWT authentication
        });
      },
    }),
  ],
});