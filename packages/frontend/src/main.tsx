import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { httpBatchLink } from '@trpc/client';
import { trpc } from './lib/trpc';
import App from './App';
import './index.css';

// Create a query client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5000,
    },
  },
});

// Create tRPC client
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';
const trpcClient = trpc.createClient({
  links: [
    httpBatchLink({
      url: `${API_URL}/api/trpc`,
      headers() {
        // Include token from localStorage in headers for authentication
        const token = localStorage.getItem('auth-token');
        return token ? { authorization: `Bearer ${token}` } : {};
      },
    }),
  ],
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </trpc.Provider>
  </React.StrictMode>
);