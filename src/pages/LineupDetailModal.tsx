import { useState } from 'react'
import { motion } from 'framer-motion'
import SelectMenu from '../components/SelectMenu'
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

  // Beim Doppel ist die Reihenfolge die Position: Slot 1 = Sturm, Slot 2 = Tor.
  // Bei bestehenden Slots steht Sturm (attack) durch die Normalisierung an Index 0.
  const [player1, setPlayer1] = useState(slot?.players[0] ?? '')
  const [player2, setPlayer2] = useState(slot?.players[1] ?? '')

  const save = () => {
    if (isDouble) {
      const picks: [string, 'attack' | 'defense'][] = []
      if (player1) picks.push([player1, 'attack'])   // oben = Sturm
      if (player2) picks.push([player2, 'defense'])  // unten = Tor
      onSave({ gameIndex, type: game.type, isGoalieSingles: isGoalie, players: picks.map(p => p[0]), positions: picks.map(p => p[1]) })
    } else {
      onSave({ gameIndex, type: game.type, isGoalieSingles: isGoalie, players: player1 ? [player1] : [], positions: [] })
    }
  }

  const playerOptions = (exclude?: string) => [
    { value: '', label: '— nicht besetzt —' },
    ...activePlayers.filter(p => p.id !== exclude).map(p => ({ value: p.id, label: p.name })),
  ]

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
        <div className="w-10 h-1 rounded-full bg-fg/20 mx-auto mt-3 mb-5" />

        <div className="px-6 pb-8 space-y-5">
          {/* Header */}
          <div className="flex items-center gap-3">
            <h2 className="text-fg font-bold text-xl flex-1">{gameLabel} — {isDouble ? 'Doppel' : 'Einzel'}</h2>
            {isGoalie && (
              <span className="text-[12px] font-semibold bg-unicorn-gold/18 text-accent-gold px-2.5 py-1 rounded-lg">
                🥅 Goalie
              </span>
            )}
          </div>

          <div className="h-px bg-fg/8" />

          {/* Player 1 – beim Doppel = Sturm */}
          <div>
            <label className="block text-fg/45 text-[12px] font-semibold tracking-widest uppercase mb-2">
              {isDouble ? '⚔ Sturm' : 'Spieler'}
            </label>
            <SelectMenu<string>
              variant="block"
              ariaLabel={isDouble ? 'Sturm' : 'Spieler'}
              value={player1}
              options={playerOptions(isDouble ? player2 : undefined)}
              onChange={setPlayer1}
            />
          </div>

          {/* Player 2 – beim Doppel = Tor */}
          {isDouble && (
            <>
              <div className="h-px bg-fg/8" />
              <div>
                <label className="block text-fg/45 text-[12px] font-semibold tracking-widest uppercase mb-2">🥅 Tor</label>
                <SelectMenu<string>
                  variant="block"
                  ariaLabel="Tor"
                  value={player2}
                  options={playerOptions(player1)}
                  onChange={setPlayer2}
                />
              </div>
            </>
          )}

          {/* Availability hint */}
          <div className="bg-surface2 rounded-xl px-4 py-2.5">
            <p className="text-fg/50 text-[13px]">⏱ Verfügbarkeit wird beim Neuberechnen berücksichtigt</p>
          </div>

          {/* Buttons */}
          <div className="flex gap-3 pt-1">
            <button onClick={onClose} className="flex-1 py-3.5 rounded-2xl bg-surface2 text-fg/65 font-semibold text-[16px]">
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
