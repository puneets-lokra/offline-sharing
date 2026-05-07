import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

// When building for GitHub Pages, set base to the repo sub-path.
// GITHUB_PAGES=true npm run build
const isGitHubPages = process.env.GITHUB_PAGES === 'true';

export default defineConfig({
  base: isGitHubPages ? '/offline-sharing/' : '/',
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'icons/*.png'],
      manifest: false,
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
        runtimeCaching: [
          {
            urlPattern: /^http:\/\/192\.168\.137\.1:\d+\/health$/,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'bridge-health',
              networkTimeoutSeconds: 3,
            },
          },
        ],
      },
    }),
  ],
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
});
