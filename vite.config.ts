import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// Frontend dev server. The backend Fastify API runs separately on :3000;
// requests to /v1/* are proxied there so the capture UI can post captures.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      '/v1': {
        target: process.env.API_PROXY || 'http://localhost:3010',
        changeOrigin: true,
      },
    },
  },
});
