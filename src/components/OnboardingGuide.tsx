import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

export const ONBOARDING_VERSION = 1
export const ONBOARDING_KEY = 'hornstrike_onboarding_version'

export function shouldShowOnboarding(): boolean {
  const stored = Number(localStorage.getItem(ONBOARDING_KEY) ?? '0')
  return stored < ONBOARDING_VERSION
}

export function markOnboardingDone() {
  localStorage.setItem(ONBOARDING_KEY, String(ONBOARDING_VERSION))
}

export function resetOnboarding() {
  localStorage.removeItem(ONBOARDING_KEY)
}

// ─── Slide content ────────────────────────────────────────────────────────────

const SLIDES = [
  {
    icon: '🦄',
    title: 'Willkommen bei Hornstrike!',
    body: 'Der Aufstellungsplaner der Fellow Unicorns für die Hamburger Liga. In wenigen Schritten zur optimalen Aufstellung.',
    hint: null,
  },
  {
    icon: '👥',
    title: 'Spieler anlegen',
    body: 'Lege einmalig alle Spieler eures Kaders an. Jeder Spieler bekommt Präferenzen: bevorzugte Position, Einzel oder Doppel, Goalie – und mehr.',
    hint: '→ Tab „Spieler" → + Neuer Spieler',
  },
  {
    icon: '📅',
    title: 'Spieltag planen',
    body: 'Wähle für jeden Spieltag die aktiv spielenden Personen aus. Wer später kommt oder früher geht, kann individuell eingestellt werden.',
    hint: '→ Tab „Spieltag" → + Neu',
  },
  {
    icon: '✨',
    title: 'Aufstellung berechnen',
    body: 'Hornstrike berechnet automatisch die optimale Aufstellung – unter Berücksichtigung aller Präferenzen und der Liga-Regeln (max. 2 Einzel + 2 Doppel pro Spieler, keine doppelten Pärchen).',
    hint: '→ „Aufstellung berechnen"',
  },
  {
    icon: '✏️',
    title: 'Manuell anpassen',
    body: 'Du kannst die Aufstellung jederzeit manuell ändern: Spieler per Drag & Drop tauschen, einzelne Slots tippen zum Bearbeiten, oder die ganze Aufstellung neu berechnen lassen.',
    hint: '→ Pill ziehen · ✎ tippen · ⟳ Neu',
  },
  {
    icon: '🏆',
    title: 'Los geht\'s!',
    body: 'Viel Erfolg beim nächsten Spieltag! Unter Einstellungen findest du Export/Import für Backups und kannst diese Tour jederzeit neu starten.',
    hint: null,
  },
]

// ─── Component ────────────────────────────────────────────────────────────────

interface Props {
  onDone: () => void
}

export default function OnboardingGuide({ onDone }: Props) {
  const [index, setIndex] = useState(0)
  const [direction, setDirection] = useState(1)
  const isLast = index === SLIDES.length - 1
  const slide = SLIDES[index]

  const go = (next: number) => {
    setDirection(next > index ? 1 : -1)
    setIndex(next)
  }

  const finish = () => {
    markOnboardingDone()
    onDone()
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-app">
      {/* Ambient glow */}
      <div className="absolute w-[500px] h-[500px] rounded-full bg-unicorn-violet/50 blur-[160px] -top-20 -left-20 pointer-events-none" />
      <div className="absolute w-[400px] h-[400px] rounded-full bg-unicorn-pink/20 blur-[140px] bottom-0 right-0 pointer-events-none" />

      {/* Skip */}
      <div className="relative flex justify-end px-6 pt-14">
        <button onClick={finish} className="text-fg/35 text-sm font-medium">
          Überspringen
        </button>
      </div>

      {/* Slide */}
      <div className="relative flex-1 flex flex-col items-center justify-center px-8 overflow-hidden">
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={index}
            custom={direction}
            variants={{
              enter: (d: number) => ({ x: d * 60, opacity: 0 }),
              center: { x: 0, opacity: 1 },
              exit: (d: number) => ({ x: d * -60, opacity: 0 }),
            }}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.28, ease: 'easeInOut' }}
            className="flex flex-col items-center text-center w-full"
          >
            {/* Icon */}
            <div className="w-24 h-24 rounded-3xl bg-unicorn-violet/50 border border-fg/10 flex items-center justify-center text-5xl mb-8 shadow-xl">
              {slide.icon}
            </div>

            {/* Title */}
            <h2 className="text-[26px] font-bold text-fg leading-tight mb-4">
              {slide.title}
            </h2>

            {/* Body */}
            <p className="text-fg/65 text-[16px] leading-relaxed max-w-sm">
              {slide.body}
            </p>

            {/* Hint pill */}
            {slide.hint && (
              <div className="mt-6 bg-surface border border-fg/10 rounded-full px-5 py-2.5">
                <p className="text-accent-cyan text-[13px] font-medium">{slide.hint}</p>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Dot indicator */}
      <div className="relative flex justify-center gap-2 pb-6">
        {SLIDES.map((_, i) => (
          <button
            key={i}
            onClick={() => go(i)}
            className={`rounded-full transition-all ${
              i === index
                ? 'w-5 h-2 bg-unicorn-pink'
                : 'w-2 h-2 bg-fg/20'
            }`}
          />
        ))}
      </div>

      {/* Navigation buttons */}
      <div className="relative flex gap-3 px-6 pb-12">
        {index > 0 && (
          <button
            onClick={() => go(index - 1)}
            className="flex-1 py-4 rounded-3xl bg-surface text-fg/60 font-semibold text-[16px]"
          >
            ← Zurück
          </button>
        )}
        <button
          onClick={isLast ? finish : () => go(index + 1)}
          className="flex-1 py-4 rounded-3xl bg-unicorn-pink text-white font-bold text-[17px] shadow-xl shadow-unicorn-pink/40"
        >
          {isLast ? 'Loslegen 🦄' : 'Weiter →'}
        </button>
      </div>
    </div>
  )
}
