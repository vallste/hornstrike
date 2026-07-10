import { createClient, type SupabaseClient } from '@supabase/supabase-js'

// Öffentliche Werte (dürfen im Bundle landen). Sicherheit ruht vollständig auf
// Postgres Row-Level-Security — der service_role-Key gehört NIE ins Frontend.
const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

/**
 * true, sobald beide Env-Vars gesetzt sind. In Phase 0 (noch kein Projekt)
 * ist das `false` und die App läuft unverändert auf localStorage weiter.
 */
export const isSupabaseConfigured = Boolean(url && anonKey)

/**
 * Der Supabase-Client – oder `null`, solange die App nicht konfiguriert ist.
 * Auth-Optionen umgesetzt wie im Plan:
 *  - PKCE-Flow (sauber mit HashRouter + ?code Redirect)
 *  - Session persistieren + Token automatisch erneuern → monatelang eingeloggt
 */
export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(url as string, anonKey as string, {
      auth: {
        flowType: 'pkce',
        detectSessionInUrl: true,
        persistSession: true,
        autoRefreshToken: true,
      },
    })
  : null

/**
 * Liefert den Client oder wirft, wenn Supabase nicht konfiguriert ist.
 * Consumer ab Phase 1 verwenden diesen Getter statt des nullable `supabase`.
 */
export function getSupabase(): SupabaseClient {
  if (!supabase) {
    throw new Error(
      'Supabase ist nicht konfiguriert – VITE_SUPABASE_URL und VITE_SUPABASE_ANON_KEY fehlen.',
    )
  }
  return supabase
}
