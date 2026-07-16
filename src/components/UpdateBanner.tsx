import { useEffect, useRef, useState } from 'react'
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore – virtual module provided by vite-plugin-pwa at build time
import { useRegisterSW } from 'virtual:pwa-register/react'
import { motion, AnimatePresence } from 'framer-motion'

export default function UpdateBanner() {
  const [updating, setUpdating] = useState(false)
  const reloading = useRef(false)

  // Sobald der neue SW die Kontrolle übernimmt (autoUpdate + skipWaiting) → Seite neu laden
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return
    const handler = () => {
      if (reloading.current) return
      reloading.current = true
      setUpdating(true)
      // Kurze Verzögerung damit der Toast sichtbar ist
      setTimeout(() => window.location.reload(), 800)
    }
    navigator.serviceWorker.addEventListener('controllerchange', handler)
    return () => navigator.serviceWorker.removeEventListener('controllerchange', handler)
  }, [])

  // Update-Polling alle 10 Min
  useRegisterSW({
    onRegisteredSW(_swUrl: string, r: { update: () => void } | undefined) {
      if (r) setInterval(() => r.update(), 10 * 60 * 1000)
    },
  })

  return (
    <AnimatePresence>
      {updating && (
        <motion.div
          initial={{ opacity: 0, y: 80 }}
          animate={{ opacity: 1, y: 0 }}
          className="fixed bottom-24 left-4 right-4 z-50 bg-unicorn-violet border border-accent-cyan/40 rounded-2xl px-4 py-3.5 flex items-center gap-3 shadow-xl"
        >
          <span className="text-2xl flex-shrink-0 animate-spin">⟳</span>
          <div>
            <p className="text-fg font-semibold text-[14px]">App wird aktualisiert…</p>
            <p className="text-fg/50 text-[12px]">Einen Moment bitte.</p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
