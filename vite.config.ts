import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// Root-Deployment unter eigener Domain (hornstrike.de). Für den alten
// Projekt-Pfad vallste.github.io/hornstrike/ wäre '/hornstrike/' nötig.
const BASE = '/'

export default defineConfig({
  base: BASE,
  server: {
    // Fester Port: verhindert Drift auf 5174/… (sonst passt der OTP-Redirect
    // nicht mehr zur Supabase Redirect-Allow-List). Bei belegtem Port bricht
    // Vite bewusst ab, statt still auf einen anderen Port auszuweichen.
    port: 5173,
    strictPort: true,
    host: true,   // auf allen Interfaces lauschen (IPv4+IPv6) – sonst nur [::1], Browser-127.0.0.1 scheitert
    allowedHosts: ['sw.mladev.phoneresearch.local'],
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'icons/*.png'],
      manifest: {
        name: 'Hornstrike – Fellow Unicorns',
        short_name: 'Hornstrike',
        description: 'Tischfussball Aufstellungsplaner für die Hamburger Liga',
        theme_color: '#1a0533',
        background_color: '#1a0533',
        display: 'standalone',
        orientation: 'portrait',
        start_url: BASE,
        scope: BASE,
        icons: [
          {
            src: 'icons/icon-192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}']
      }
    })
  ]
})
