import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  base: '/hf4a-cards/',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'robots.txt'],
      manifest: {
        name: 'HF4A Card Explorer',
        short_name: 'HF4A Cards',
        description: 'Browse and search High Frontier 4 All game cards',
        theme_color: '#1a1a2e',
        background_color: '#0f0f1a',
        display: 'standalone',
        icons: [
          {
            src: 'icon-192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: 'icon-512.png',
            sizes: '512x512',
            type: 'image/png',
          },
        ],
      },
      workbox: {
        // Exclude card images from precaching - they use runtime caching instead
        globPatterns: ['**/*.{js,css,html,json,woff2}'],
        globIgnores: ['**/cards/**'],
        runtimeCaching: [
          {
            urlPattern: /\/cards\/thumbs\//,
            handler: 'CacheFirst',
            options: {
              cacheName: 'card-thumbnails',
              expiration: { maxEntries: 500, maxAgeSeconds: 60 * 60 * 24 * 30 },
            },
          },
          {
            urlPattern: /\/cards\/full\//,
            handler: 'CacheFirst',
            options: {
              cacheName: 'card-full-images',
              expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 30 },
            },
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': '/src',
    },
  },
});
