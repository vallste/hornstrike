import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useSession } from '../context/SessionProvider'
import { useTeamStatus } from '../lib/permissions'
import LoadingScreen from './LoadingScreen'

/**
 * Layout-Route für den eingeloggten Bereich.
 * - Ohne Supabase-Konfiguration: keine Sperre (App läuft wie bisher lokal).
 * - Session lädt: Ladeanzeige.
 * - Ohne Session: → /login.
 * - Eingeloggt, aber (noch) kein Team: → /request-club (Onboarding).
 */
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
  return <Outlet />
}
