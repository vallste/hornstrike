import { useEffect, useState } from 'react'

/**
 * Hält den Bildschirm wach, solange `active` gilt.
 *
 * Stand September 2026: Chrome/Android seit 84, Safari erst seit 18.4 (März
 * 2025) – dasselbe Update hat auch den Bug behoben, durch den die API in
 * installierten iOS-PWAs wirkungslos war. Auf älteren Geräten passiert schlicht
 * nichts; das ist ein Fallback, kein Fehlerfall, deshalb bleibt alles still.
 *
 * Zwei Eigenheiten der API, die hier abgefangen werden:
 *  - Das Lock wird automatisch freigegeben, sobald die Seite in den Hintergrund
 *    geht. Es muss bei `visibilitychange` neu angefordert werden.
 *  - Der Request kann abgelehnt werden (Akkusparmodus, Nutzereinstellung) und
 *    wirft dann – niemals in die UI durchreichen.
 *
 * @returns `supported` = Browser kennt die API, `held` = Bildschirm wird
 *          gerade wachgehalten (erst damit lässt sich das ehrlich anzeigen).
 */
export function useWakeLock(active: boolean): { supported: boolean; held: boolean } {
  const supported = typeof navigator !== 'undefined' && 'wakeLock' in navigator
  const [held, setHeld] = useState(false)

  useEffect(() => {
    if (!supported || !active) {
      setHeld(false)
      return
    }

    // StrictMode führt Effekte doppelt aus: `cancelled` verhindert, dass ein
    // Lock aus einem bereits aufgeräumten Durchlauf bestehen bleibt.
    let cancelled = false
    let sentinel: WakeLockSentinel | null = null

    const acquire = async () => {
      if (cancelled || document.visibilityState !== 'visible' || sentinel) return
      try {
        const next = await navigator.wakeLock.request('screen')
        if (cancelled) {
          void next.release().catch(() => { /* egal */ })
          return
        }
        sentinel = next
        setHeld(true)
        // Das System kann jederzeit selbst freigeben – Anzeige nachziehen.
        next.addEventListener('release', () => {
          sentinel = null
          if (!cancelled) setHeld(false)
        })
      } catch {
        setHeld(false)
      }
    }

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') void acquire()
    }

    void acquire()
    document.addEventListener('visibilitychange', onVisibilityChange)

    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', onVisibilityChange)
      setHeld(false)
      if (sentinel) {
        void sentinel.release().catch(() => { /* egal */ })
        sentinel = null
      }
    }
  }, [supported, active])

  return { supported, held }
}
