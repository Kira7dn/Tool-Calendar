import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const backendTarget = process.env.VITE_BACKEND_URL || 'http://localhost:59607'

export default defineConfig({
  publicDir: '../wwwroot',
  plugins: [
    tailwindcss(),
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
        navigateFallbackDenylist: [/^\/api/],
      },
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'masked-icon.svg'],
      manifest: {
        name: 'Hệ Thống Điều Phối, Quản Lý Văn Bản',
        short_name: 'Lịch Công Tác',
        description: 'Hệ thống quản lý lịch công tác và điều phối, quản lý văn bản',
        theme_color: '#ffffff',
        background_color: '#ffffff',
        display: 'standalone',
        icons: [
          {
            src: '/assets/logo.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: '/assets/logo.png',
            sizes: '512x512',
            type: 'image/png',
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    strictPort: false,
    fs: {
      allow: ['..'],
    },
    proxy: {
      '/api': backendTarget,
      '/notificationHub': {
        target: backendTarget,
        ws: true,
      },
      '/Uploads': backendTarget,
      '/assets': backendTarget,
      '/partials': backendTarget,
      '/sw.js': backendTarget,
    },
  },
  build: {
    outDir: '../wwwroot',
    emptyOutDir: false,
    assetsDir: 'vite-assets',
    rollupOptions: {
      input: {
        index: resolve(__dirname, 'index.html'),
      },
    },
  },
})
