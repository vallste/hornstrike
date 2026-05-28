import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import Header from '../components/Header'
import ToggleGroup from '../components/ToggleGroup'
import { usePlayers } from '../store'
import type { Player, Position, GameTypePreference } from '../types'
import { uuid } from '../utils/uuid'

const POSITIONS: { value: Position; label: string }[] = [
  { value: 'attack', label: 'Sturm' },
  { value: 'both', label: 'Beides' },
  { value: 'defense', label: 'Tor' },
]
const POSITION_PREFS: { value: Position; label: string }[] = [
  { value: 'attack_preferred', label: 'Sturm >' },
  { value: 'both', label: 'Beides' },
  { value: 'defense_preferred', label: 'Tor >' },
]

const GAME_TYPES: { value: GameTypePreference; label: string }[] = [
  { value: 'singles_only', label: 'Einzel' },
  { value: 'both', label: 'Beides' },
  { value: 'doubles_only', label: 'Doppel' },
]

function defaultPrefs(): Player['preferences'] {
  return { position: 'both', gameType: 'both', goaliePreference: false, partnerPreferences: [] }
}

export default function PlayerEditorPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { players, addPlayer, updatePlayer } = usePlayers()
  const isNew = id === 'new'
  const existing = players.find(p => p.id === id)

  const [name, setName] = useState(existing?.name ?? '')
  const [prefs, setPrefs] = useState(existing?.preferences ?? defaultPrefs())

  useEffect(() => {
    if (!isNew && !existing) navigate('/players', { replace: true })
  }, [isNew, existing, navigate])

  const save = () => {
    if (!name.trim()) return
    if (isNew) {
      addPlayer({ id: uuid(), name: name.trim(), preferences: prefs })
    } else if (existing) {
      updatePlayer({ ...existing, name: name.trim(), preferences: prefs })
    }
    navigate('/players')
  }

  const setPref = <K extends keyof Player['preferences']>(key: K, val: Player['preferences'][K]) =>
    setPrefs(p => ({ ...p, [key]: val }))

  return (
    <div className="min-h-screen bg-unicorn-purple pb-32">
      <div className="absolute w-[360px] h-[360px] rounded-full bg-unicorn-violet/40 blur-[140px] top-0 right-0 pointer-events-none" />

      <Header
        title={isNew ? 'Neuer Spieler' : (existing?.name ?? 'Spieler')}
        back
        right={
          <button onClick={save} className="bg-unicorn-pink text-white text-sm font-semibold px-4 py-1.5 rounded-full">
            Speichern
          </button>
        }
      />

      <div className="relative px-6 space-y-6 mt-2">
        {/* Name */}
        <div>
          <label className="block text-white/45 text-[13px] font-semibold tracking-widest uppercase mb-2">Name</label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Vollständiger Name"
            className="w-full bg-[#2b0b4c] text-white placeholder-white/30 rounded-xl px-4 py-3 text-base outline-none focus:ring-2 focus:ring-unicorn-pink/60"
          />
        </div>

        {/* Position */}
        <div>
          <label className="block text-white/45 text-[13px] font-semibold tracking-widest uppercase mb-2">Position</label>
          <ToggleGroup
            options={POSITIONS}
            value={['attack','both','defense'].includes(prefs.position) ? prefs.position : 'both'}
            onChange={v => setPref('position', v)}
          />
          <div className="mt-2">
            <ToggleGroup
              options={POSITION_PREFS}
              value={['attack_preferred','both','defense_preferred'].includes(prefs.position) ? prefs.position : 'both'}
              onChange={v => setPref('position', v)}
              accent="cyan"
            />
          </div>
          <p className="text-white/30 text-xs mt-1.5">Obere Reihe: "nur"; untere Reihe: "bevorzugt"</p>
        </div>

        {/* Spieltyp */}
        <div>
          <label className="block text-white/45 text-[13px] font-semibold tracking-widest uppercase mb-2">Spieltyp</label>
          <ToggleGroup options={GAME_TYPES} value={prefs.gameType} onChange={v => setPref('gameType', v)} />
        </div>

        {/* Goalie */}
        <div>
          <label className="block text-white/45 text-[13px] font-semibold tracking-widest uppercase mb-2">Goalie</label>
          <ToggleGroup
            options={[{ value: false as unknown as string, label: 'Nein' }, { value: true as unknown as string, label: 'Ja 🥅' }]}
            value={String(prefs.goaliePreference)}
            onChange={v => setPref('goaliePreference', v === 'true')}
            accent="cyan"
          />
        </div>

        {/* Partner preferences */}
        <div>
          <label className="block text-white/45 text-[13px] font-semibold tracking-widest uppercase mb-2">Bevorzugte Partner</label>
          <div className="bg-[#2b0b4c] rounded-2xl overflow-hidden">
            {prefs.partnerPreferences.map((pp, i) => {
              const partner = players.find(p => p.id === pp.playerId)
              return (
                <motion.div
                  key={pp.playerId}
                  initial={{ opacity: 0, x: -12 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="flex items-center px-4 py-3 border-b border-white/5 last:border-0"
                >
                  <span className="flex-1 text-white text-[15px] font-medium">{partner?.name ?? '?'}</span>
                  <div className="flex items-center gap-2">
                    {[1, 2, 3].map(w => (
                      <button
                        key={w}
                        onClick={() => {
                          const updated = [...prefs.partnerPreferences]
                          updated[i] = { ...pp, weight: w as 1 | 2 | 3 }
                          setPref('partnerPreferences', updated)
                        }}
                        className={`text-lg ${pp.weight >= w ? 'text-unicorn-gold' : 'text-white/20'}`}
                      >★</button>
                    ))}
                    <button
                      onClick={() => setPref('partnerPreferences', prefs.partnerPreferences.filter((_, j) => j !== i))}
                      className="ml-2 text-white/25 text-sm"
                    >✕</button>
                  </div>
                </motion.div>
              )
            })}

            {/* Add partner */}
            <select
              value=""
              onChange={e => {
                if (!e.target.value) return
                if (prefs.partnerPreferences.find(pp => pp.playerId === e.target.value)) return
                setPref('partnerPreferences', [...prefs.partnerPreferences, { playerId: e.target.value, weight: 2 }])
                e.target.value = ''
              }}
              className="w-full bg-transparent text-unicorn-cyan text-sm px-4 py-3 outline-none cursor-pointer"
            >
              <option value="" disabled>+ Partner hinzufügen</option>
              {players
                .filter(p => p.id !== id && !prefs.partnerPreferences.find(pp => pp.playerId === p.id))
                .map(p => <option key={p.id} value={p.id} className="bg-[#2b0b4c]">{p.name}</option>)
              }
            </select>
          </div>
        </div>
      </div>

      {/* Save CTA */}
      <div className="fixed bottom-0 left-0 right-0 px-6 pb-8 pt-4 bg-gradient-to-t from-unicorn-purple via-unicorn-purple/95 to-transparent">
        <button
          onClick={save}
          disabled={!name.trim()}
          className="w-full py-4 rounded-3xl bg-unicorn-pink text-white font-bold text-[17px] disabled:opacity-40 shadow-xl shadow-unicorn-pink/40"
        >
          Spieler speichern
        </button>
      </div>
    </div>
  )
}
