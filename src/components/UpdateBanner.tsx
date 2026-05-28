// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore – virtual module provided by vite-plugin-pwa at build time
import { useRegisterSW } from 'virtual:pwa-register/react'
import { motion, AnimatePresence } from 'framer-motion'

export default function UpdateBanner() {
  const { needRefresh: [needRefresh], updateServiceWorker } = useRegisterSW({
    onRegisteredSW(_swUrl: string, r: { update: () => void } | undefined) {
      if (r) setInterval(() => r.update(), 10 * 60 * 1000)
    },
  })

  return (
    <AnimatePresence>
      {needRefresh && (
        <motion.div
          initial={{ opacity: 0, y: 80 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 80 }}
          className="fixed bottom-24 left-4 right-4 z-50 bg-[#2b0b4c] border border-unicorn-cyan/40 rounded-2xl px-4 py-3.5 flex items-center gap-3 shadow-xl"
        >
          <span className="text-2xl flex-shrink-0">🦄</span>
          <div className="flex-1 min-w-0">
            <p className="text-white font-semibold text-[14px]">Neue Version verfügbar</p>
            <p className="text-white/50 text-[12px]">Jetzt aktualisieren für die neuesten Features.</p>
          </div>
          <button
            onClick={() => updateServiceWorker(true)}
            className="bg-unicorn-cyan text-[#1a0533] text-[13px] font-bold px-3 py-2 rounded-xl flex-shrink-0"
          >
            Update
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
