import { supabase, isSupabaseConfigured } from './supabase'
import { useScope } from '../context/ScopeProvider'

// First-Party Nutzungs-Events (eigene DB, kein Drittanbieter). Werden in
// public.app_events geschrieben (RLS: nur eigene Zeile schreibbar, nur
// Plattform-Admin lesbar). Auswertung ausschließlich aggregiert via RPC.
export type EventType =
  | 'app_open'
  | 'screen_view'
  | 'lineup_generated'
  | 'matchday_created'
  | 'poll_created'
  | 'poll_responded'
  | 'invite_created'
  | 'invite_accepted'
  | 'club_requested'
  | 'pwa_installed'
  | 'consent_accepted'

/** Optionaler Scope – landet in eigenen Spalten, NICHT in meta (meta bleibt PII-frei). */
export type TrackCtx = { teamId?: string | null; clubId?: string | null }

// ── Pfad-De-Identifizierung ───────────────────────────────────────────────────
// Erst Allowlist (damit z. B. /matchday/new literal bleibt), dann dynamische
// Muster, sonst Fallback. Rohe IDs/Tokens verlassen den Client NIE.
const STATIC_ROUTES = new Set<string>([
  '/', '/home', '/login', '/players', '/matchday', '/matchday/new',
  '/settings', '/changelog', '/request-club', '/manage', '/members',
  '/terminfindung', '/terminfindung/new',
  '/admin/club-requests', '/admin/stats',
])

const DYNAMIC_PATTERNS: [RegExp, string][] = [
  [/^\/players\/[^/]+$/, '/players/:id'],
  [/^\/matchday\/[^/]+\/edit$/, '/matchday/:id/edit'],
  [/^\/lineup\/[^/]+$/, '/lineup/:id'],
  [/^\/terminfindung\/[^/]+$/, '/terminfindung/:id'],
  [/^\/join\/[^/]+$/, '/join/:token'],
]

export function sanitizePath(pathname: string): string {
  if (STATIC_ROUTES.has(pathname)) return pathname
  for (const [re, pattern] of DYNAMIC_PATTERNS) if (re.test(pathname)) return pattern
  return '/unknown' // nie einen unbekannten Rohpfad protokollieren
}

// ── Kern: fire-and-forget Insert ──────────────────────────────────────────────
// Nie awaiten (Aufruf als `void track(...)`), wirft nie in die UI, no-op ohne
// Supabase/Session.
export async function track(
  type: EventType,
  meta: Record<string, unknown> = {},
  ctx: TrackCtx = {},
): Promise<void> {
  try {
    if (!isSupabaseConfigured || !supabase) return
    const { data } = await supabase.auth.getSession() // lokaler Read, kein Netz
    const uid = data.session?.user.id
    if (!uid) return // nur eingeloggt (RLS erzwingt user_id = auth.uid())
    await supabase.from('app_events').insert({
      user_id: uid,
      type,
      meta,
      team_id: ctx.teamId ?? null,
      club_id: ctx.clubId ?? null,
    })
  } catch {
    /* Analytics darf niemals einen Fehler in die UI bringen. */
  }
}

/** Scoped `track` für Seiten-Komponenten (teamId/clubId aus dem aktuellen Scope). */
export function useTrack(): (type: EventType, meta?: Record<string, unknown>) => void {
  const { currentTeamId, currentClubId } = useScope()
  return (type, meta) => void track(type, meta, { teamId: currentTeamId, clubId: currentClubId })
}
