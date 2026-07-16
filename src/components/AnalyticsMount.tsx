import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { useSession } from '../context/SessionProvider'
import { track, sanitizePath } from '../lib/analytics'

const isStandalone = () =>
  window.matchMedia?.('(display-mode: standalone)').matches ||
  (navigator as unknown as { standalone?: boolean }).standalone === true

/**
 * Unsichtbarer Läufer für die übergreifenden Nutzungs-Events (app_open,
 * screen_view, pwa_installed). Liegt unter HashRouter + SessionProvider.
 */
export default function AnalyticsMount() {
  const { session } = useSession()
  const location = useLocation()
  const uid = session?.user.id

  // app_open – einmal pro Tab-Session, sobald eine Session existiert.
  useEffect(() => {
    if (!uid) return
    if (sessionStorage.getItem('hs_evt_app_open')) return
    sessionStorage.setItem('hs_evt_app_open', '1')
    void track('app_open', { standalone: isStandalone() })
  }, [uid])

  // screen_view – bei jedem Routenwechsel (Pfad de-identifiziert; no-op ohne Session).
  useEffect(() => {
    void track('screen_view', { path: sanitizePath(location.pathname) })
  }, [location.pathname])

  // PWA-Installation: echtes appinstalled-Event + einmaliger Standalone-Backfill.
  useEffect(() => {
    const onInstalled = () => void track('pwa_installed', { source: 'appinstalled' })
    const onBIP = (e: Event) => e.preventDefault() // für einen späteren Install-Button
    window.addEventListener('appinstalled', onInstalled)
    window.addEventListener('beforeinstallprompt', onBIP)
    if (isStandalone() && !localStorage.getItem('hs_pwa_installed')) {
      localStorage.setItem('hs_pwa_installed', '1')
      void track('pwa_installed', { source: 'standalone-detect' })
    }
    return () => {
      window.removeEventListener('appinstalled', onInstalled)
      window.removeEventListener('beforeinstallprompt', onBIP)
    }
  }, [])

  return null
}
