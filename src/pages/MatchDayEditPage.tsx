import { useState, useMemo } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import Header from '../components/Header'
import LoadingScreen from '../components/LoadingScreen'
import { usePlayers, useMatchDays } from '../store'
import type { MatchDayPlayer } from '../types'
import { GAME_SEQUENCE } from '../types'
import { validateLineup } from '../utils/validateLineup'

const maxGame = GAME_SEQUENCE.length

export default function MatchDayEditPage() {
  const { id } = useParams()
  const { matchDays, isLoading } = useMatchDays()
  const matchDay = matchDays.find(m => m.id === id)
  if (isLoading) return <LoadingScreen />
  if (!matchDay) return <Navigate to="/matchday" replace />
  return <MatchDayEditForm key={matchDay.id} />
}

function MatchDayEditForm() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { players } = usePlayers()
  const { matchDays, updateMatchDay } = useMatchDays()
  const matchDay = matchDays.find(m => m.id === id)!

  const [date, setDate] = useState(matchDay.date ?? '')
  const [opponent, setOpponent] = useState(matchDay.opponent ?? '')
  const [useGoalie, setUseGoalie] = useState(matchDay.useGoalie ?? false)
  const [useFifthDouble, setUseFifthDouble] = useState(matchDay.useFifthDouble ?? false)
  const [selected, setSelected] = useState<Record<string, boolean>>(
    Object.fromEntries((matchDay.players ?? []).map(p => [p.playerId, true]))
  )
  const [availability, setAvailability] = useState<Record<string, { from: number; to: number }>>(
    Object.fromEntries((matchDay.players ?? []).map(p => [p.playerId, { from: p.availableFrom, to: p.availableTo }]))
  )
  const [expanded, setExpanded] = useState<string | null>(null)

  const activePlayers = players.filter(p => selected[p.id])

  const setAvail = (pid: string, key: 'from' | 'to', val: number) =>
    setAvailability(av => {
      const current = av[pid] ?? { from: 1, to: maxGame }
      return { ...av, [pid]: { ...current, [key]: val } }
    })

  const playerName = (pid: string) => players.find(p => p.id === pid)?.name ?? '?'

  // Zeige Warnungen wenn aktuelle Spielerauswahl die Aufstellung invalidiert
  const configViolations = useMemo(() => {
    if (!matchDay) return []
    const newActiveIds = activePlayers.map(p => p.id)
    return validateLineup(matchDay.lineup, playerName, newActiveIds)
      .filter(v => v.message.includes('nicht mehr aktiv'))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activePlayers, matchDay])

  const save = () => {
    if (activePlayers.length < 2) return
    const mdPlayers: MatchDayPlayer[] = activePlayers.map(p => ({
      playerId: p.id,
      availableFrom: availability[p.id]?.from ?? 1,
      availableTo: availability[p.id]?.to ?? maxGame,
    }))
    // Lineup bleibt unverändert – Neuberechnung erfolgt manuell über "⟳ Neu" in der Aufstellung
    updateMatchDay({ ...matchDay, date, opponent: opponent.trim() || undefined, useGoalie, useFifthDouble, players: mdPlayers })
    navigate(`/lineup/${matchDay.id}`)
  }

  return (
    <div className="min-h-screen bg-app pb-32">
      <div className="absolute w-[400px] h-[400px] rounded-full bg-unicorn-violet/35 blur-[140px] bottom-40 -left-14 pointer-events-none" />

      <Header title="Spieltag bearbeiten" back={`/lineup/${matchDay.id}`} />

      <div className="relative px-6 space-y-3 mt-4">
        {/* Date */}
        <div className="relative bg-surface rounded-2xl px-4 py-3.5 flex items-center justify-between">
          <div>
            <p className="text-fg/45 text-[12px] font-semibold tracking-widest uppercase">Datum</p>
            <p className="text-fg font-semibold text-lg mt-0.5">
              {new Date(date + 'T12:00:00').toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' })}
            </p>
          </div>
          <span className="text-2xl">📅</span>
          <input
            type="date"
            lang="de"
            value={date}
            onChange={e => setDate(e.target.value)}
            onClick={e => e.currentTarget.showPicker?.()}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          />
        </div>

        {/* Opponent */}
        <div className="bg-surface rounded-2xl px-4 py-3.5">
          <p className="text-fg/45 text-[12px] font-semibold tracking-widest uppercase mb-1.5">Gegner (optional)</p>
          <input
            type="text" value={opponent} onChange={e => setOpponent(e.target.value)}
            placeholder="z. B. Kickerfreunde Hamburg"
            className="w-full bg-transparent text-fg placeholder-fg/25 text-base outline-none"
          />
        </div>

        {/* Goalie */}
        <button onClick={() => setUseGoalie(v => !v)} className="bg-surface rounded-2xl px-4 py-3.5 flex items-center justify-between w-full">
          <div className="text-left">
            <p className="text-fg font-semibold text-[15px]">🥅 Goalie (E5/E6)</p>
            <p className="text-fg/40 text-xs mt-0.5">E5 und E6 als Goalie-Einzel spielen</p>
          </div>
          <div className={`w-12 h-6 rounded-full transition-colors relative ${useGoalie ? 'bg-unicorn-pink' : 'bg-surface2'}`}>
            <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-fg shadow transition-transform ${useGoalie ? 'translate-x-6' : 'translate-x-0.5'}`} />
          </div>
        </button>

        {/* 5. Doppel */}
        <button
          onClick={() => activePlayers.length >= 5 && setUseFifthDouble(v => !v)}
          className={`bg-surface rounded-2xl px-4 py-3.5 flex items-center justify-between w-full transition-opacity ${activePlayers.length < 5 ? 'opacity-40' : ''}`}
        >
          <div className="text-left">
            <p className="text-fg font-semibold text-[15px]">🎯 5. Doppel (D5)</p>
            <p className="text-fg/40 text-xs mt-0.5">
              {activePlayers.length < 5 ? 'Mindestens 5 Spieler erforderlich' : 'E3 + E4 werden durch D5 ersetzt'}
            </p>
          </div>
          <div className={`w-12 h-6 rounded-full transition-colors relative ${useFifthDouble ? 'bg-unicorn-cyan' : 'bg-surface2'}`}>
            <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-fg shadow transition-transform ${useFifthDouble ? 'translate-x-6' : 'translate-x-0.5'}`} />
          </div>
        </button>

        {/* Players */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <p className="text-fg/45 text-[13px] font-semibold tracking-widest uppercase">Aktive Spieler ({activePlayers.length})</p>
            <button
              onClick={() => {
                const allSelected = players.every(p => selected[p.id])
                const next: Record<string, boolean> = {}
                players.forEach(p => { next[p.id] = !allSelected })
                setSelected(next)
              }}
              className="text-accent-cyan text-[13px] font-semibold"
            >
              {players.every(p => selected[p.id]) ? 'Alle abwählen' : 'Alle auswählen'}
            </button>
          </div>

          <div className="space-y-2">
            {players.map(player => {
              const isChecked = !!selected[player.id]
              const avail = availability[player.id]
              const isExpanded = expanded === player.id && isChecked
              return (
                <div key={player.id} className="bg-surface rounded-2xl overflow-hidden">
                  <div className="flex items-center px-4 py-3.5 gap-3">
                    <button
                      onClick={() => setSelected(s => ({ ...s, [player.id]: !s[player.id] }))}
                      className={`w-6 h-6 rounded-lg flex-shrink-0 flex items-center justify-center transition-colors ${isChecked ? 'bg-unicorn-pink' : 'bg-surface2 border border-fg/20'}`}
                    >
                      {isChecked && <span className="text-fg text-xs font-bold">✓</span>}
                    </button>
                    <span className={`flex-1 text-[15px] font-semibold transition-opacity ${isChecked ? 'text-fg' : 'text-fg/35'}`}>{player.name}</span>
                    {isChecked && (
                      <>
                        {avail && (avail.from > 1 || avail.to < maxGame) && (
                          <span className="text-accent-cyan text-xs bg-unicorn-cyan/15 px-2 py-0.5 rounded-md">
                            {avail.from > 1 ? `ab ${avail.from}` : ''}{avail.from > 1 && avail.to < maxGame ? ' · ' : ''}{avail.to < maxGame ? `bis ${avail.to}` : ''}
                          </span>
                        )}
                        <button onClick={() => setExpanded(isExpanded ? null : player.id)} className="text-fg/30 text-sm ml-1" style={{ transform: isExpanded ? 'rotate(180deg)' : 'none' }}>▾</button>
                      </>
                    )}
                  </div>
                  {isExpanded && (
                    <div className="px-4 pb-4 pt-0 border-t border-fg/5 space-y-3">
                      {(['from', 'to'] as const).map(key => (
                        <div key={key} className="flex items-center gap-3">
                          <span className="text-fg/50 text-sm w-28">{key === 'from' ? 'Ab Spiel Nr.' : 'Bis Spiel Nr.'}</span>
                          <input
                            type="number" min={1} max={maxGame}
                            value={avail?.[key] ?? (key === 'from' ? 1 : maxGame)}
                            onChange={e => setAvail(player.id, key, Math.max(1, Math.min(maxGame, +e.target.value)))}
                            className="w-16 bg-surface2 text-fg text-center rounded-lg py-1 outline-none focus:ring-1 focus:ring-unicorn-cyan/50"
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 px-6 pb-8 pt-4 bg-gradient-to-t from-app via-app/95 to-transparent space-y-3">
        {configViolations.length > 0 && (
          <div className="bg-amber-900/80 border border-amber-500/40 rounded-2xl px-4 py-3">
            <p className="text-amber-300 text-[12px] font-bold tracking-wider uppercase mb-1">⚠ Aufstellung betroffen</p>
            {configViolations.map((v, i) => (
              <p key={i} className="text-amber-200/80 text-[13px]">· {v.message}</p>
            ))}
            <p className="text-amber-200/50 text-[11px] mt-1.5">Nach dem Speichern: „⟳ Neu" in der Aufstellung drücken.</p>
          </div>
        )}
        <button
          onClick={save}
          disabled={activePlayers.length < 2}
          className="w-full py-4 rounded-3xl bg-unicorn-pink text-white font-bold text-[17px] disabled:opacity-40 shadow-xl shadow-unicorn-pink/40"
        >
          Speichern
        </button>
      </div>
    </div>
  )
}
