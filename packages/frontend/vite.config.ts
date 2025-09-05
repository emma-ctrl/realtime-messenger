import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // Enable @/ imports for src folder
      '@': resolve(__dirname, './src'),
    },
  },
  server: {
    // Development server settings
    port: 3000,
    host: true, // Allow external connections
    open: true, // Auto-open browser
  },
  build: {
    // Production build settings
    outDir: 'dist',
    sourcemap: true, // Generate source maps for debugging
    // Optimize chunk splitting
    rollupOptions: {
      output: {
        manualChunks: {
          // Separate vendor chunk for better caching
          vendor: ['react', 'react-dom'],
          trpc: ['@trpc/client', '@trpc/react-query'],
        },
      },
    },
  },
  // Environment variable prefix (for client-side access)
  envPrefix: 'VITE_',
})