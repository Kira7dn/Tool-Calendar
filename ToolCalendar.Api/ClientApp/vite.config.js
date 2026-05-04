import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { resolve } from 'node:path';

const backendTarget = process.env.VITE_BACKEND_URL || 'http://localhost:59607';

export default defineConfig({
  publicDir: '../wwwroot',
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
      '@legacy': resolve(__dirname, './src/legacy-assets')
    }
  },
  server: {
    port: 5173,
    strictPort: false,
    fs: {
      allow: ['..']
    },
    proxy: {
      '/api': backendTarget,
      '/notificationHub': {
        target: backendTarget,
        ws: true
      },
      '/Uploads': backendTarget,
      '/assets': backendTarget,
      '/partials': backendTarget,
      '/sw.js': backendTarget
    }
  },
  build: {
    outDir: '../wwwroot',
    emptyOutDir: false,
    assetsDir: 'vite-assets',
    rollupOptions: {
      input: {
        index: resolve(__dirname, 'index.html'),
        login: resolve(__dirname, 'login.html')
      }
    }
  }
});
