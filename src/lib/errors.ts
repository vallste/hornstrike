// Übersetzt Supabase-/Postgres-/RPC-Fehler in nutzerfreundliche Texte, damit
// keine technischen Details (Tabellen-, Constraint-, Spaltennamen) in die UI
// gelangen (Schutz vor Information Disclosure). Unbekanntes → Fallback.
// Reine Funktion (ohne Seiteneffekte) – auch im Render nutzbar.
type MaybeErr = { message?: unknown; code?: unknown } | null | undefined

// Eigene, im SQL geworfene Ausnahmen (raise exception '…').
const CUSTOM: Record<string, string> = {
  'not authorized': 'Dafür fehlt dir die Berechtigung.',
  'invite invalid, expired, or already used': 'Diese Einladung ist ungültig, abgelaufen oder bereits eingelöst.',
  'invite email mismatch': 'Diese Einladung wurde an eine andere E-Mail-Adresse ausgestellt – bitte mit genau dieser Adresse anmelden.',
  'player already claimed': 'Dieser Spieler ist bereits mit einem Konto verknüpft.',
}

// Postgres-SQLSTATE-Codes.
const BY_CODE: Record<string, string> = {
  '23505': 'Dieser Eintrag existiert bereits.',
  '23503': 'Der Vorgang ist nicht möglich – es hängen noch verknüpfte Daten daran.',
  '23502': 'Eingabe unvollständig – ein Pflichtfeld fehlt.',
  '23514': 'Eingabe ungültig.',
  '42501': 'Dafür fehlt dir die Berechtigung.',
}

export function errorMessage(
  err: unknown,
  fallback = 'Etwas ist schiefgelaufen. Bitte versuche es später erneut.',
): string {
  const raw = typeof err === 'string' ? err : String((err as MaybeErr)?.message ?? '')
  const code = String((err as MaybeErr)?.code ?? '')
  if (raw && CUSTOM[raw]) return CUSTOM[raw]
  if (code && BY_CODE[code]) return BY_CODE[code]
  if (/row-level security/i.test(raw)) return 'Dafür fehlt dir die Berechtigung.'
  return fallback
}
