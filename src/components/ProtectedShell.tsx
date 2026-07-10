import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useSession } from '../context/SessionProvider'
import LoadingScreen from './LoadingScreen'

/**
 * Layout-Route für den eingeloggten Bereich.
 * - Ohne Supabase-Konfiguration: keine Sperre (App läuft wie bisher lokal).
 * - Solange die Session lädt: Ladeanzeige (kein Flackern von /login).
 * - Ohne Session: Weiterleitung auf /login.
 * (Scope/currentTeam kommt in einem späteren Schritt dazu.)
 */
export default function ProtectedShell() {
  const { session, loading, configured } = useSession()
  const location = useLocation()

  if (!configured) return <Outlet />
  if (loading) return <LoadingScreen />
  if (!session) return <Navigate to="/login" replace state={{ from: location }} />
  return <Outlet />
}
