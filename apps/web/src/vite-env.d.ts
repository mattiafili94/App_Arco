/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/react" />

/** Versione dell'app, presa da apps/web/package.json al momento della build. */
declare const __VERSIONE_APP__: string

interface ImportMetaEnv {
  /** Indirizzo del progetto Supabase (es. https://xxxx.supabase.co). */
  readonly VITE_SUPABASE_URL?: string
  /** Chiave pubblica di Supabase: è fatta per stare nell'app, non è un segreto. */
  readonly VITE_SUPABASE_PUBLISHABLE_KEY?: string
}
