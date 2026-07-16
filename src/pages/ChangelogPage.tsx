import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Header from '../components/Header'
import BottomNav from '../components/BottomNav'
import { CHANGELOG, TYPE_LABEL, TYPE_COLOR } from '../data/changelog'

export default function ChangelogPage() {
  // Neueste Version standardmäßig geöffnet
  const [open, setOpen] = useState<string | null>(CHANGELOG[0]?.version ?? null)

  return (
    <div className="min-h-screen bg-app pb-24">
      <div className="absolute w-[380px] h-[380px] rounded-full bg-unicorn-violet/40 blur-[140px] -top-20 right-0 pointer-events-none" />

      <Header title="Changelog" back="/settings" />

      <div className="relative px-6 space-y-3 mt-4">
        {CHANGELOG.map((entry, idx) => {
          const isOpen = open === entry.version
          const isLatest = idx === 0
          return (
            <div key={entry.version} className="bg-surface rounded-2xl overflow-hidden">
              {/* Version header */}
              <button
                onClick={() => setOpen(isOpen ? null : entry.version)}
                className="w-full flex items-center px-4 py-4 gap-3 text-left"
              >
                <div className="flex-1 flex items-center gap-2.5 flex-wrap">
                  <span className="text-fg font-bold text-[16px]">v{entry.version}</span>
                  {isLatest && (
                    <span className="text-[10px] font-bold bg-unicorn-cyan/15 text-accent-cyan px-2 py-0.5 rounded-full">
                      Aktuell
                    </span>
                  )}
                  <span className="text-fg/35 text-[13px]">
                    {new Date(entry.date).toLocaleDateString('de-DE', {
                      day: 'numeric', month: 'long', year: 'numeric',
                    })}
                  </span>
                </div>
                <motion.span
                  animate={{ rotate: isOpen ? 180 : 0 }}
                  transition={{ duration: 0.2 }}
                  className="text-fg/30 text-sm flex-shrink-0"
                >
                  ▾
                </motion.span>
              </button>

              {/* Change list */}
              <AnimatePresence initial={false}>
                {isOpen && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.22, ease: 'easeInOut' }}
                    className="overflow-hidden"
                  >
                    <div className="px-4 pb-4 pt-1 border-t border-fg/5 space-y-2.5">
                      {entry.changes.map((c, i) => (
                        <div key={i} className="flex items-start gap-2.5">
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded flex-shrink-0 mt-0.5 ${TYPE_COLOR[c.type]}`}>
                            {TYPE_LABEL[c.type]}
                          </span>
                          <span className="text-fg/65 text-[13px] leading-snug">{c.text}</span>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )
        })}
      </div>

      <BottomNav />
    </div>
  )
}
