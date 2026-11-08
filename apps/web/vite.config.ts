import { readFileSync } from 'node:fs'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

const { version } = JSON.parse(
  readFileSync(new URL('./package.json', import.meta.url), 'utf8'),
) as {
  version: string
}

export default defineConfig({
  define: {
    __VERSIONE_APP__: JSON.stringify(version),
  },
  plugins: [
    react(),
    // App installabile e utilizzabile offline (PWA).
    VitePWA({
      // Una nuova versione non si installa da sola: l'app mostra "Nuova versione pronta".
      registerType: 'prompt',
      pwaAssets: { config: true, overrideManifestIcons: true },
      manifest: {
        name: 'Arcieri Eugubini',
        short_name: 'Arcieri Eugubini',
        description: 'Gare, risultati e allenamento della A.S.D. Compagnia Arcieri Eugubini',
        lang: 'it',
        start_url: '/gare',
        scope: '/',
        display: 'standalone',
        // Colori di avvio: background-canvas del tema chiaro (design-system/tokens.json).
        background_color: '#f5f5f5',
        theme_color: '#f5f5f5',
      },
      workbox: {
        // Ogni indirizzo dell'app si apre anche offline.
        navigateFallback: '/index.html',
        // Notifiche push (public/push.js): il motore offline le mostra e apre la gara al tocco.
        importScripts: ['push.js'],
        // Il manifest lo aggiunge già il plugin: elencarlo qui lo duplicherebbe e il motore
        // offline non si installerebbe ("add-to-cache-list-conflicting-entries").
        globPatterns: ['**/*.{js,css,html,svg,png,ico}'],
      },
    }),
  ],
  server: {
    // Rende l'app raggiungibile anche dal telefono sulla stessa rete Wi-Fi
    host: true,
  },
})
