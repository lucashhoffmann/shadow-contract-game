import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';
import { COLORS } from './src/shared/colors.ts';

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    {
      name: 'game-theme-color',
      transformIndexHtml: (html) =>
        html.replace('__GAME_THEME_COLOR__', COLORS.ui.background),
    },
    // App instalavel (PWA): manifesto e service worker gerados no build.
    // 'prompt': a versao nova fica esperando e quem aplica e src/resources/pwa.ts,
    // so com o jogador na tela inicial.
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['icon.png'],
      manifest: {
        name: 'Shadow Contract',
        short_name: 'Shadow',
        description: 'Jogo stealth top-down: atravesse as salas sem ser visto.',
        lang: 'pt-BR',
        start_url: '/',
        display: 'fullscreen',
        background_color: COLORS.ui.background,
        theme_color: COLORS.ui.background,
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'icon-maskable.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // modelos (public/models) entram junto: sem eles o jogo offline
        // cairia nos personagens de pecas
        globPatterns: ['**/*.{js,css,html,png,svg,woff2,glb,gltf,bin}'],
        cleanupOutdatedCaches: true,
        // fontes vem do Google Fonts: guarda no aparelho para jogar offline
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\//,
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'google-fonts-css' },
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\//,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-files',
              expiration: { maxEntries: 8, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    globals: true,
    css: true,
  },
  server: {
    host: true,
  },
});
