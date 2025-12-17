import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    server: {
      host: '0.0.0.0', // Allows access from network (Phone)
      hmr: {
        // Fixes the "ws://localhost:undefined" error on mobile
        protocol: 'ws',
        host: 'localhost', 
      }
    },
    plugins: [
      react(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'masked-icon.svg'],
        manifest: {
          name: 'Vitalis Animal Tracker (VAT)',
          short_name: 'VitalisVAT',
          description: 'Livestock identification, registration, and tracking system.',
          theme_color: '#059669',
          background_color: '#ffffff',
          display: 'standalone',
          start_url: '/',
          orientation: 'portrait',
          icons: [
            {
              src: 'https://cdn-icons-png.flaticon.com/512/2674/2674068.png',
              sizes: '192x192',
              type: 'image/png'
            },
            {
              src: 'https://cdn-icons-png.flaticon.com/512/2674/2674068.png',
              sizes: '512x512',
              type: 'image/png'
            }
          ]
        },
        devOptions: {
          enabled: true
        }
      })
    ],
    define: {
      'process.env': env
    }
  }
})