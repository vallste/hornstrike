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
  'cannot remove the last captain of the team': 'Der letzte Captain eines Teams kann nicht entfernt werden. Ernenne zuerst eine weitere Person zum Captain.',
  'cannot remove the last admin of the club': 'Der letzte Vereins-Admin kann nicht entfernt werden. Ernenne zuerst eine weitere Person zum Vereins-Admin.',
  'invalid role': 'Diese Rolle kann hier nicht vergeben werden.',
  'team not found': 'Team nicht gefunden.',
  'club not found': 'Verein nicht gefunden.',
  // Client-seitige Bildaufbereitung (src/lib/avatars.ts).
  'avatar: not an image': 'Bitte eine Bilddatei auswählen.',
  'avatar: input too large': 'Diese Datei ist zu groß. Bitte ein Bild unter 25 MB wählen.',
  'avatar: output too large': 'Das Bild ließ sich nicht klein genug rechnen. Bitte ein anderes wählen.',
  'avatar: decode failed': 'Das Bild konnte nicht gelesen werden. Bitte ein anderes Format probieren.',
  'avatar: encode failed': 'Das Bild konnte nicht verarbeitet werden. Bitte ein anderes wählen.',
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
  // Storage-Grenzen des avatars-Buckets (file_size_limit / allowed_mime_types).
  if (/exceeded the maximum allowed size|payload too large/i.test(raw))
    return 'Das Bild ist zu groß für den Upload. Bitte ein kleineres wählen.'
  if (/mime type .* is not supported|invalid_mime_type/i.test(raw))
    return 'Dieses Bildformat wird nicht unterstützt. Bitte JPG, PNG oder WebP wählen.'
  return fallback
}
