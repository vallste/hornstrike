import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import Header from '../components/Header'
import BottomNav from '../components/BottomNav'
import TimeField from '../components/TimeField'
import { usePlayers, useMatchDays } from '../store'
import type { MatchDayPlayer } from '../types'
import { generateLineup } from '../utils/lineup'
import { GAME_SEQUENCE } from '../types'
import { uuid } from '../utils/uuid'

export default function MatchDaySetupPage() {
  const navigate = useNavigate()
  const location = useLocation()
  // Vorbefüllung aus der Terminfindung (Datum + verfügbare Spieler)
  const prefill = (location.state as { date?: string; playerIds?: string[]; time?: string; location?: string; opponent?: string } | null) ?? {}
  const { players } = usePlayers()
  const { addMatchDay } = useMatchDays()

  const [date, setDate] = useState(prefill.date ?? new Date().toISOString().split('T')[0])
  const [startTime, setStartTime] = useState(prefill.time ?? '')
  const [venue, setVenue] = useState(prefill.location ?? '')
  const [opponent, setOpponent] = useState(prefill.opponent ?? '')
  const [useGoalie, setUseGoalie] = useState(false)
  const [useFifthDouble, setUseFifthDouble] = useState(false)
  const [selected, setSelected] = useState<Record<string, boolean>>(
    () => Object.fromEntries((prefill.playerIds ?? []).map(id => [id, true])),
  )
  const [availability, setAvailability] = useState<Record<string, { from: number; to: number }>>({})
  const [expanded, setExpanded] = useState<string | null>(null)

  const maxGame = GAME_SEQUENCE.length

  const togglePlayer = (id: string) =>
    setSelected(s => ({ ...s, [id]: !s[id] }))

  const setAvail = (id: string, key: 'from' | 'to', val: number) =>
    setAvailability(av => {
      const current = av[id] ?? { from: 1, to: maxGame }
      return { ...av, [id]: { ...current, [key]: val } }
    })

  const rosterPlayers = players.filter(p => p.active !== false)
  const activePlayers = rosterPlayers.filter(p => selected[p.id])

  const calculate = () => {
    if (activePlayers.length < 2) return
    const mdPlayers: MatchDayPlayer[] = activePlayers.map(p => ({
      playerId: p.id,
      availableFrom: availability[p.id]?.from ?? 1,
      availableTo: availability[p.id]?.to ?? maxGame,
    }))
    const lineup = generateLineup(players, mdPlayers, useGoalie, useFifthDouble)
    const id = uuid()
    addMatchDay({ id, date, startTime: startTime || null, location: venue.trim() || null, opponent: opponent.trim() || undefined, useGoalie, useFifthDouble, players: mdPlayers, lineup })
    navigate(`/lineup/${id}`)
  }

  return (
    <div className="min-h-screen bg-app pb-52">
      <div className="absolute w-[400px] h-[400px] rounded-full bg-unicorn-violet/35 blur-[140px] bottom-40 -left-14 pointer-events-none" />

      <Header title="Spieltag planen" back="/matchday" />

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
            type="text"
            value={opponent}
            onChange={e => setOpponent(e.target.value)}
            placeholder="z. B. Kickerfreunde Hamburg"
            className="w-full bg-transparent text-fg placeholder-fg/25 text-base outline-none"
          />
        </div>

        {/* Uhrzeit + Ort */}
        <div className="flex gap-3">
          <div className="flex-1 bg-surface rounded-2xl px-4 py-3.5">
            <p className="text-fg/45 text-[12px] font-semibold tracking-widest uppercase mb-1.5">Uhrzeit</p>
            <TimeField value={startTime} onChange={setStartTime} className="w-full" />
          </div>
          <div className="flex-[1.4] bg-surface rounded-2xl px-4 py-3.5">
            <p className="text-fg/45 text-[12px] font-semibold tracking-widest uppercase mb-1.5">Ort</p>
            <input type="text" value={venue} onChange={e => setVenue(e.target.value)} placeholder="Sporthalle…" className="w-full bg-transparent text-fg placeholder-fg/25 text-base outline-none" />
          </div>
        </div>

        {/* Goalie toggle */}
        <button
          onClick={() => setUseGoalie(v => !v)}
          className="bg-surface rounded-2xl px-4 py-3.5 flex items-center justify-between w-full"
        >
          <div className="text-left">
            <p className="text-fg font-semibold text-[15px]">🥅 Goalie (E5/E6)</p>
            <p className="text-fg/40 text-xs mt-0.5">E5 und E6 als Goalie-Einzel spielen</p>
          </div>
          <div className={`w-12 h-6 rounded-full transition-colors relative ${useGoalie ? 'bg-unicorn-pink' : 'bg-surface2'}`}>
            <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-fg shadow transition-transform ${useGoalie ? 'translate-x-6' : 'translate-x-0.5'}`} />
          </div>
        </button>

        {/* 5. Doppel toggle */}
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
            <p className="text-fg/45 text-[13px] font-semibold tracking-widest uppercase">
              Aktive Spieler ({activePlayers.length})
            </p>
            <button
              onClick={() => {
                const allSelected = rosterPlayers.every(p => selected[p.id])
                const next: Record<string, boolean> = {}
                rosterPlayers.forEach(p => { next[p.id] = !allSelected })
                setSelected(next)
              }}
              className="text-accent-cyan text-[13px] font-semibold"
            >
              {rosterPlayers.every(p => selected[p.id]) ? 'Alle abwählen' : 'Alle auswählen'}
            </button>
          </div>

          {rosterPlayers.length === 0 && (
            <p className="text-fg/40 text-sm bg-surface rounded-xl p-4">
              Noch keine Spieler angelegt.{' '}
              <button className="text-accent-cyan underline" onClick={() => navigate('/players')}>
                Jetzt hinzufügen →
              </button>
            </p>
          )}

          <div className="space-y-2">
            {rosterPlayers.map(player => {
              const isChecked = !!selected[player.id]
              const avail = availability[player.id]
              const isExpanded = expanded === player.id && isChecked
              return (
                <div key={player.id} className="bg-surface rounded-2xl overflow-hidden">
                  <div className="flex items-center px-4 py-3.5 gap-3">
                    <button
                      onClick={() => togglePlayer(player.id)}
                      className={`w-6 h-6 rounded-lg flex-shrink-0 flex items-center justify-center transition-colors ${
                        isChecked ? 'bg-unicorn-pink' : 'bg-surface2 border border-fg/20'
                      }`}
                    >
                      {isChecked && <span className="text-fg text-xs font-bold">✓</span>}
                    </button>
                    <span className={`flex-1 text-[15px] font-semibold transition-opacity ${isChecked ? 'text-fg' : 'text-fg/35'}`}>
                      {player.name}
                    </span>
                    {isChecked && (
                      <>
                        {avail && (
                          <span className="text-accent-cyan text-xs bg-unicorn-cyan/15 px-2 py-0.5 rounded-md">
                            {avail.from > 1 ? `ab E${avail.from - 1}` : ''}{avail.to < maxGame ? ` bis D${maxGame}` : ''}
                          </span>
                        )}
                        <button
                          onClick={() => setExpanded(isExpanded ? null : player.id)}
                          className="text-fg/30 text-sm ml-1 transition-transform"
                          style={{ transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)' }}
                        >▾</button>
                      </>
                    )}
                  </div>

                  {isExpanded && (
                    <div className="px-4 pb-4 pt-0 border-t border-fg/5 space-y-3">
                      <div className="flex items-center gap-3">
                        <span className="text-fg/50 text-sm w-28">Ab Spiel Nr.</span>
                        <input
                          type="number" min={1} max={maxGame}
                          value={avail?.from ?? 1}
                          onChange={e => setAvail(player.id, 'from', Math.max(1, Math.min(maxGame, +e.target.value)))}
                          className="w-16 bg-surface2 text-fg text-center rounded-lg py-1 outline-none focus:ring-1 focus:ring-unicorn-cyan/50"
                        />
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-fg/50 text-sm w-28">Bis Spiel Nr.</span>
                        <input
                          type="number" min={1} max={maxGame}
                          value={avail?.to ?? maxGame}
                          onChange={e => setAvail(player.id, 'to', Math.max(1, Math.min(maxGame, +e.target.value)))}
                          className="w-16 bg-surface2 text-fg text-center rounded-lg py-1 outline-none focus:ring-1 focus:ring-unicorn-cyan/50"
                        />
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* CTA */}
      <div className="fixed bottom-20 left-0 right-0 px-6 pb-4 pt-4 bg-gradient-to-t from-app via-app/95 to-transparent">
        <button
          onClick={calculate}
          disabled={activePlayers.length < 2}
          className="w-full py-4 rounded-3xl bg-unicorn-pink text-white font-bold text-[17px] disabled:opacity-40 shadow-xl shadow-unicorn-pink/40"
        >
          Aufstellung berechnen ✨
        </button>
      </div>

      <BottomNav />
    </div>
  )
}
