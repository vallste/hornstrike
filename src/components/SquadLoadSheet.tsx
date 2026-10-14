import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { usePlayers, useMatchDays } from '../store'
import { squadLoad, averageSets } from '../lib/matchStats'

// Einsatzverteilung über die Saison – als Entscheidungshilfe beim Aufstellen.
//
// Sortiert bewusst aufsteigend: oben steht, wer am wenigsten gespielt hat.
// Das ist die Reihenfolge, in der man beim nächsten Spieltag schauen will.

/** Lokales Datum als ISO – `toISOString()` rechnet nach UTC und kippt abends. */
function isoDay(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Saisonbeginn: 1. August. Vor dem 1. August gehört man noch zur vorigen Saison. */
function seasonStart(today = new Date()): string {
  const year = today.getMonth() >= 7 ? today.getFullYear() : today.getFullYear() - 1
  return `${year}-08-01`
}

/** „2026/27" – so, wie der Verband die Spielzeit benennt. */
function seasonLabel(start: string): string {
  const year = Number(start.slice(0, 4))
  return `${year}/${String((year + 1) % 100).padStart(2, '0')}`
}

const formatDay = (iso: string) =>
  new Date(`${iso}T12:00:00`).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })

type Range = 'season' | 'all' | 'custom'

export default function SquadLoadSheet({ onClose }: { onClose: () => void }) {
  const { players } = usePlayers()
  const { matchDays } = useMatchDays()

  const [range, setRange] = useState<Range>('season')
  const [customFrom, setCustomFrom] = useState(seasonStart())

  const season = seasonStart()
  const since = range === 'all' ? undefined : range === 'season' ? season : (customFrom || undefined)
  // Ausschließend: der heutige Spieltag zählt noch nicht mit.
  const until = isoDay(new Date())

  const rows = useMemo(() => {
    const load = squadLoad(matchDays, since, until)
    const byId = new Map(load.map(l => [l.playerId, l]))
    // Alle aktiven Personen zeigen – wer nie dran war, gehört ganz nach oben.
    return players
      .filter(p => p.active)
      .map(p => byId.get(p.id) ?? { playerId: p.id, sets: 0, matchdays: 0 })
      .sort((a, b) => a.sets - b.sets || averageSets(a) - averageSets(b))
  }, [players, matchDays, since, until])

  const counted = useMemo(() => {
    const ids = new Set<string>()
    for (const md of matchDays) {
      if (since && md.date < since) continue
      if (md.date >= until) continue
      if ((md.lineup ?? []).some(s => !s.forfeit && s.players.length > 0)) ids.add(md.id)
    }
    return ids.size
  }, [matchDays, since, until])

  const max = Math.max(1, ...rows.map(r => r.sets))
  const playerName = (id: string) => players.find(p => p.id === id)?.name ?? '?'

  const tab = (value: Range, label: string) => (
    <button
      key={value}
      onClick={() => setRange(value)}
      className={`flex-1 py-1.5 rounded-lg text-[13px] font-semibold transition-colors ${
        range === value ? 'bg-surface2 text-fg' : 'text-fg/40'
      }`}
    >
      {label}
    </button>
  )

  return (
    <>
      <motion.div
        className="fixed inset-0 bg-black/65 z-50"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose}
      />
      <motion.div
        className="fixed bottom-0 left-0 right-0 bg-[#1f0840] rounded-t-[28px] z-50 pb-safe max-h-[88vh] overflow-y-auto"
        initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 28, stiffness: 300 }}
      >
        <div className="w-10 h-1 rounded-full bg-fg/20 mx-auto mt-3 mb-5" />

        <div className="px-6 pb-8 space-y-4">
          <div>
            <h2 className="text-fg font-bold text-xl">Einsätze</h2>
            <p className="text-fg/45 text-[13px] mt-1">
              Wer am wenigsten gespielt hat, steht oben.
            </p>
          </div>

          <div className="flex bg-surface rounded-xl p-1">
            {tab('season', 'Saison')}
            {tab('all', 'Alles')}
            {tab('custom', 'Ab …')}
          </div>

          {range === 'custom' && (
            <div className="bg-surface rounded-2xl px-4 py-3">
              <p className="text-fg/45 text-[12px] font-semibold tracking-widest uppercase mb-1.5">Ab Datum</p>
              <input
                type="date"
                value={customFrom}
                onChange={e => setCustomFrom(e.target.value)}
                className="w-full bg-transparent text-fg text-base outline-none"
              />
            </div>
          )}

          {/* Der Zeitraum steht immer dabei – „Saison" ist eine Festlegung,
              keine Selbstverständlichkeit. */}
          <div className="bg-surface rounded-xl px-3 py-2">
            <p className="text-fg/70 text-[12px] font-semibold">
              {range === 'season' && `Saison ${seasonLabel(season)} · ab ${formatDay(season)}`}
              {range === 'all' && 'Alle Spieltage'}
              {range === 'custom' && (customFrom ? `ab ${formatDay(customFrom)}` : 'Alle Spieltage')}
              {' '}bis gestern
            </p>
            <p className="text-fg/35 text-[11px] mt-0.5">
              {counted === 0
                ? 'Keine Spieltage mit Aufstellung in diesem Zeitraum.'
                : `${counted} ${counted === 1 ? 'Spieltag' : 'Spieltage'} mit Aufstellung · heutige und künftige zählen nicht mit`}
            </p>
          </div>

          {counted > 0 && (
            <div className="bg-surface rounded-2xl overflow-hidden">
              {rows.map(row => {
                const avg = averageSets(row)
                return (
                  <div key={row.playerId} className="px-4 py-2.5 border-b border-fg/5 last:border-b-0">
                    <div className="flex items-baseline gap-3">
                      <p className="text-fg text-[14px] font-medium flex-1 truncate">{playerName(row.playerId)}</p>
                      <span className="text-accent-cyan text-[16px] font-bold tabular-nums">{row.sets}</span>
                      <span className="text-fg/35 text-[11px] w-20 text-right tabular-nums">
                        {row.matchdays === 0
                          ? 'nie dabei'
                          : `${row.matchdays}× · ⌀ ${avg.toFixed(1)}`}
                      </span>
                    </div>
                    <div className="h-1 bg-surface2 rounded-full mt-1.5 overflow-hidden">
                      <div
                        className="h-full bg-accent-cyan/50 rounded-full"
                        style={{ width: `${(row.sets / max) * 100}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          <p className="text-fg/30 text-[11px] leading-snug">
            Gezählt wird die Aufstellung (Einzel = 1 Satz, Doppel = 2), nicht das erfasste Ergebnis.
            Der Schnitt bezieht sich auf alle Spieltage, an denen die Person im Kader stand – auch die ohne Einsatz.
          </p>

          <button
            onClick={onClose}
            className="w-full py-3 rounded-2xl bg-surface text-fg/70 text-[15px] font-semibold"
          >
            Schließen
          </button>
        </div>
      </motion.div>
    </>
  )
}
