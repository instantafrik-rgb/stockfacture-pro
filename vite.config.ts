import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(() => {
  return {
    base: '/stockfacture-pro/',

    plugins: [
      react(),
      tailwindcss(),

      VitePWA({
        registerType: 'autoUpdate',

        includeAssets: ['icon.svg'],

        manifest: {
          id: '/stockfacture-pro/',
          name: 'StockFacture Pro',
          short_name: 'StockFacture',
          description:
            'Gestion commerciale simple et professionnelle - Stock, Factures, Devis, Paiements',

          theme_color: '#0f172a',
          background_color: '#0f172a',

          display: 'standalone',
          orientation: 'portrait',

          start_url: '/stockfacture-pro/',
          scope: '/stockfacture-pro/',

          icons: [
            {
              src: '/stockfacture-pro/icon.svg',
              sizes: '192x192 512x512',
              type: 'image/svg+xml',
              purpose: 'any',
            },
          ],
        },

        workbox: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
        },

        devOptions: {
          enabled: true,
          type: 'module',
        },
      }),
    ],

    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },

    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
