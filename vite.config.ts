import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// Generate a short 4-character build hash from timestamp
const buildTime = Date.now();
const buildHash = buildTime.toString(36).slice(-4).toUpperCase();

// Deploy URL: https://hf4a.github.io/
export default defineConfig({
  base: '/',
  define: {
    __BUILD_HASH__: JSON.stringify(buildHash),
    __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
  },
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
        globPatterns: ['**/*.{js,css,html,json,woff2,wasm}'],
        globIgnores: ['**/cards/**'],
        // Increase limit for ONNX runtime bundle (~11MB + 24MB WASM)
        maximumFileSizeToCacheInBytes: 40 * 1024 * 1024,
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
          {
            urlPattern: /\/models\/.*\.(onnx|txt)$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'ocr-models',
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 30 },
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
