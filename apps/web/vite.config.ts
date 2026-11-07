import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    // Rende l'app raggiungibile anche dal telefono sulla stessa rete Wi-Fi
    host: true,
  },
})
