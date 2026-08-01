import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useSession } from '../context/SessionProvider'
import { useTeamStatus } from '../lib/permissions'
import LoadingScreen from './LoadingScreen'

/**
 * Layout-Route für den eingeloggten Bereich.
 * - Ohne Supabase-Konfiguration: keine Sperre (App läuft wie bisher lokal).
 * - Session lädt: Ladeanzeige.
 * - Ohne Session: → /login.
 * - Eingeloggt, ohne jeglichen Zugriff: → /request-club (Onboarding).
 * - Vereins-Admin/Plattform-Admin OHNE Team ('club-only'): darf verwalten,
 *   wird aber von team-abhängigen Seiten auf /manage geleitet (dort legt er
 *   sein erstes Team an) statt in der /request-club-Sackgasse zu landen.
 */
// Seiten, die ohne ausgewähltes Team sinnvoll sind (Verwaltung/Info).
const CLUB_ONLY_OK = new Set([
  '/manage', '/settings', '/request-club', '/changelog',
  '/admin/club-requests', '/admin/stats',
])

export default function ProtectedShell() {
  const { session, loading, configured } = useSession()
  const location = useLocation()
  const teamStatus = useTeamStatus()

  if (!configured) return <Outlet />
  if (loading) return <LoadingScreen />
  if (!session) return <Navigate to="/login" replace state={{ from: location }} />
  if (teamStatus === 'loading') return <LoadingScreen />
  if (teamStatus === 'none' && location.pathname !== '/request-club') {
    return <Navigate to="/request-club" replace />
  }
  if (teamStatus === 'club-only' && !CLUB_ONLY_OK.has(location.pathname)) {
    return <Navigate to="/manage" replace />
  }
  return <Outlet />
}
