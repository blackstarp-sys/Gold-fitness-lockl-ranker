import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'path';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const disableHmr = env.DISABLE_HMR === 'true' || process.env.DISABLE_HMR === 'true';

  return {
    plugins: [
      react(), 
      tailwindcss(),
      VitePWA({
        registerType: 'autoUpdate',
        devOptions: {
          enabled: false
        },
        manifest: {
          name: "Goldfitness-localranker",
          short_name: "RankLocal",
          description: "Manage your Google My Business profile with AI-powered tools.",
          theme_color: "#2563eb",
          background_color: "#ffffff",
          display: "standalone",
          start_url: "/dashboard",
          icons: [
            {
              src: "/icons/icon-192x192.svg",
              sizes: "192x192",
              type: "image/svg+xml",
              purpose: "any maskable"
            },
            {
              src: "/icons/icon-512x512.svg",
              sizes: "512x512",
              type: "image/svg+xml",
              purpose: "any maskable"
            }
          ]
        }
      })
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      host: '0.0.0.0',
      port: 3000,
      hmr: disableHmr ? false : true,
      watch: disableHmr ? null : {},
    },
  };
});
