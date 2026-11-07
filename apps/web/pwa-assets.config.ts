import { defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config'

// Icone dell'app (Android, iPhone, scheda del browser) generate da public/icona.svg durante la build.
// Lo sfondo delle icone "a tutto schermo" (maskable, iPhone) è il blu società.
const bluSocieta = '#1e4fa8'

export default defineConfig({
  preset: {
    ...minimal2023Preset,
    maskable: { ...minimal2023Preset.maskable, resizeOptions: { background: bluSocieta } },
    apple: { ...minimal2023Preset.apple, resizeOptions: { background: bluSocieta } },
  },
  images: ['public/icona.svg'],
})
