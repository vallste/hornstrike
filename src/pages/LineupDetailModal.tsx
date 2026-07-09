import { useState } from 'react'
import { motion } from 'framer-motion'
import ToggleGroup from '../components/ToggleGroup'
import type { Player, MatchDayPlayer, GameSlot } from '../types'
import { getGameSequence, isGoalieGameIndex } from '../types'

interface Props {
  gameIndex: number
  gameLabel: string
  slot: GameSlot | null
  matchDayPlayers: MatchDayPlayer[]
  allPlayers: Player[]
  useFifthDouble: boolean
  onSave: (slot: GameSlot) => void
  onClose: () => void
}

export default function LineupDetailModal({ gameIndex, gameLabel, slot, matchDayPlayers, allPlayers, useFifthDouble, onSave, onClose }: Props) {
  const game = getGameSequence(useFifthDouble).find(g => g.gameIndex === gameIndex)!
  const isDouble = game.type === 'doubles'
  const isGoalie = slot?.isGoalieSingles ?? isGoalieGameIndex(gameIndex, useFifthDouble)

  const activePlayers = allPlayers.filter(p => matchDayPlayers.find(m => m.playerId === p.id))

  const [player1, setPlayer1] = useState(slot?.players[0] ?? '')
  const [player2, setPlayer2] = useState(slot?.players[1] ?? '')
  const [pos1, setPos1] = useState<'attack' | 'defense'>(slot?.positions?.[0] ?? 'attack')
  const [pos2, setPos2] = useState<'attack' | 'defense'>(slot?.positions?.[1] ?? 'defense')

  const save = () => {
    const players = isDouble ? [player1, player2].filter(Boolean) : [player1].filter(Boolean)
    const positions = isDouble ? [pos1, pos2] : [pos1]
    onSave({ gameIndex, type: game.type, isGoalieSingles: isGoalie, players, positions })
  }

  const posOptions = [{ value: 'attack' as const, label: 'Sturm' }, { value: 'defense' as const, label: 'Torwart' }]

  return (
    <>
      {/* Overlay */}
      <motion.div
        className="fixed inset-0 bg-black/65 z-50"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose}
      />

      {/* Sheet */}
      <motion.div
        className="fixed bottom-0 left-0 right-0 bg-[#1f0840] rounded-t-[28px] z-50 pb-safe"
        initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 28, stiffness: 300 }}
      >
        {/* Handle */}
        <div className="w-10 h-1 rounded-full bg-white/20 mx-auto mt-3 mb-5" />

        <div className="px-6 pb-8 space-y-5">
          {/* Header */}
          <div className="flex items-center gap-3">
            <h2 className="text-white font-bold text-xl flex-1">{gameLabel} — {isDouble ? 'Doppel' : 'Einzel'}</h2>
            {isGoalie && (
              <span className="text-[12px] font-semibold bg-unicorn-gold/18 text-unicorn-gold px-2.5 py-1 rounded-lg">
                🥅 Goalie
              </span>
            )}
          </div>

          <div className="h-px bg-white/8" />

          {/* Player 1 */}
          <div>
            <label className="block text-white/45 text-[12px] font-semibold tracking-widest uppercase mb-2">
              {isDouble ? 'Spieler 1' : 'Spieler'}
            </label>
            <select
              value={player1}
              onChange={e => setPlayer1(e.target.value)}
              className="w-full bg-[#391060] text-white rounded-xl px-4 py-3 outline-none text-[15px]"
            >
              <option value="">— nicht besetzt —</option>
              {activePlayers.map(p => (
                <option key={p.id} value={p.id} className="bg-[#2b0b4c]">{p.name}</option>
              ))}
            </select>
          </div>

          {/* Position – nur beim Doppel relevant */}
          {isDouble && (
            <div>
              <label className="block text-white/45 text-[12px] font-semibold tracking-widest uppercase mb-2">Position</label>
              <ToggleGroup options={posOptions} value={pos1} onChange={setPos1} accent="pink" />
            </div>
          )}

          {/* Player 2 (Doppel only) */}
          {isDouble && (
            <>
              <div className="h-px bg-white/8" />
              <div>
                <label className="block text-white/45 text-[12px] font-semibold tracking-widest uppercase mb-2">Spieler 2</label>
                <select
                  value={player2}
                  onChange={e => setPlayer2(e.target.value)}
                  className="w-full bg-[#391060] text-white rounded-xl px-4 py-3 outline-none text-[15px]"
                >
                  <option value="">— nicht besetzt —</option>
                  {activePlayers.filter(p => p.id !== player1).map(p => (
                    <option key={p.id} value={p.id} className="bg-[#2b0b4c]">{p.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-white/45 text-[12px] font-semibold tracking-widest uppercase mb-2">Position 2</label>
                <ToggleGroup options={posOptions} value={pos2} onChange={setPos2} accent="cyan" />
              </div>
            </>
          )}

          {/* Availability hint */}
          <div className="bg-[#391060] rounded-xl px-4 py-2.5">
            <p className="text-white/50 text-[13px]">⏱ Verfügbarkeit wird beim Neuberechnen berücksichtigt</p>
          </div>

          {/* Buttons */}
          <div className="flex gap-3 pt-1">
            <button onClick={onClose} className="flex-1 py-3.5 rounded-2xl bg-[#391060] text-white/65 font-semibold text-[16px]">
              Abbrechen
            </button>
            <button
              onClick={save}
              className="flex-1 py-3.5 rounded-2xl bg-unicorn-pink text-white font-bold text-[16px] shadow-lg shadow-unicorn-pink/40"
            >
              Fertig
            </button>
          </div>
        </div>
      </motion.div>
    </>
  )
}
