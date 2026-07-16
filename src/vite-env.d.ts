/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string
  readonly VITE_SUPABASE_ANON_KEY?: string
  // Betreiber-/Kontaktangaben für Impressum & Datenschutz (nicht im Repo –
  // via .env.local bzw. GitHub-Actions-Variables gesetzt).
  readonly VITE_LEGAL_NAME?: string
  readonly VITE_LEGAL_STREET?: string
  readonly VITE_LEGAL_CITY?: string
  readonly VITE_LEGAL_EMAIL?: string
  readonly VITE_LEGAL_PHONE?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
