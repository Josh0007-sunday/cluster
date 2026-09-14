import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';
import dns from 'dns';

dns.setDefaultResultOrder('ipv4first');

export default defineConfig(() => ({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    host: true,
    port: 5173,
    allowedHosts: ['*'],
    proxy: {
      '/api/xstocks': {
        target: 'https://api.xstocks.fi',
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/api\/xstocks/, '/api/v2/public'),
      },
    },
  },
  }));
