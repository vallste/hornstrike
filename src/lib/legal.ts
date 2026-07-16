// Betreiber-/Kontaktangaben für Impressum & Datenschutz.
// Werden zur BUILD-ZEIT aus VITE_LEGAL_* eingesetzt (import.meta.env) – so
// stehen die persönlichen Daten NICHT im (öffentlichen) Git-Repo, sondern
// kommen aus .env.local (lokal) bzw. GitHub-Actions-Variables (Deploy).
// Hinweis: Auf der ausgelieferten Seite sind die Werte öffentlich sichtbar –
// beim Impressum ist das gesetzlich auch so gewollt; Env-Vars halten sie nur
// aus dem Quell-Repo heraus, nicht vor Seitenbesuchern.
const env = import.meta.env

export const LEGAL = {
  name: env.VITE_LEGAL_NAME || '[Vollständiger Name]',
  street: env.VITE_LEGAL_STREET || '[Straße und Hausnummer]',
  city: env.VITE_LEGAL_CITY || '[PLZ und Ort]',
  email: env.VITE_LEGAL_EMAIL || '[kontakt@deine-domain.de]',
  phone: env.VITE_LEGAL_PHONE || '',
}
