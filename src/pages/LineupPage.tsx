import { useState, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  DndContext, DragOverlay, PointerSensor, TouchSensor,
  useSensor, useSensors, type DragStartEvent, type DragEndEvent,
} from '@dnd-kit/core'
import { useDraggable, useDroppable } from '@dnd-kit/core'
import Header from '../components/Header'
import BottomNav from '../components/BottomNav'
import { usePlayers, useMatchDays } from '../store'
import { generateLineup } from '../utils/lineup'
import { validateLineup } from '../utils/validateLineup'
import { getGameSequence } from '../types'
import type { GameSlot } from '../types'
import LineupDetailModal from './LineupDetailModal'

const GAME_LABELS = ['E1','E2','D1','E3','E4','D2','E5','E6','D3','E7','E8','D4','D5']

// ── Draggable pill ──────────────────────────────────────────────────────────
function DraggablePill({ id, label, accent }: { id: string; label: string; accent: string }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id })
  return (
    <span
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[12px] font-semibold cursor-grab active:cursor-grabbing select-none touch-none transition-opacity ${accent} ${isDragging ? 'opacity-30' : 'opacity-100'}`}
    >
      {label}
    </span>
  )
}

// ── Droppable slot area ─────────────────────────────────────────────────────
function DroppableSlot({ id, children }: { id: string; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id })
  return (
    <div ref={setNodeRef} className={`flex-1 min-w-0 flex flex-wrap gap-1.5 items-center transition-colors rounded-lg p-0.5 ${isOver ? 'bg-white/10' : ''}`}>
      {children}
    </div>
  )
}

export default function LineupPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { players } = usePlayers()
  const { matchDays, updateMatchDay } = useMatchDays()
  const matchDay = matchDays.find(m => m.id === id)
  const [editingSlot, setEditingSlot] = useState<number | null>(null)
  const [animKey, setAnimKey] = useState(0)
  const [dragLabel, setDragLabel] = useState<string | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
  )

  if (!matchDay) {
    return (
      <div className="min-h-screen bg-unicorn-purple flex items-center justify-center">
        <div className="text-center">
          <p className="text-white text-lg font-semibold">Spieltag nicht gefunden</p>
          <button onClick={() => navigate('/matchday')} className="text-unicorn-pink mt-4 block">← Zurück</button>
        </div>
      </div>
    )
  }

  const playerName = (pid: string) => players.find(p => p.id === pid)?.name ?? '?'

  const activePlayerIds = matchDay.players.map(p => p.playerId)
  const violations = validateLineup(matchDay.lineup, playerName, activePlayerIds)
  const violatingIndices = new Set(violations.flatMap(v => v.gameIndices))

  // Sätze pro Spieler: Einzel = 1, Doppel = 2 – useMemo stellt sicher dass DnD-Swaps sofort reflektiert werden
  const setEntries = useMemo(() => {
    const acc: Record<string, number> = {}
    for (const slot of matchDay.lineup) {
      if (slot.forfeit || slot.players.length === 0) continue
      const sets = slot.type === 'singles' ? 1 : 2
      for (const pid of slot.players) acc[pid] = (acc[pid] ?? 0) + sets
    }
    return Object.entries(acc).sort((a, b) => b[1] - a[1])
  }, [matchDay.lineup])
  const formatDate = (iso: string) => new Date(iso).toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric', month: 'long' })

  const share = async () => {
    const gameLabels = ['E1','E2','D1','E3','E4','D2','E5','E6','D3','E7','E8','D4','D5']
    const lines: string[] = [
      `🦄 Hornstrike – Fellow Unicorns`,
      `${formatDate(matchDay.date)}${matchDay.opponent ? ` vs. ${matchDay.opponent}` : ''}`,
      '',
    ]
    gameSequence.forEach((game, idx) => {
      const slot = matchDay.lineup.find(s => s.gameIndex === game.gameIndex)
      const label = gameLabels[idx] ?? game.label
      if (slot?.forfeit) {
        lines.push(`${label}: –`)
        return
      }
      if (!slot || slot.players.length === 0) {
        lines.push(`${label}: (nicht besetzt)`)
        return
      }
      if (game.type === 'singles') {
        const goalie = slot.isGoalieSingles ? ' 🥅' : ''
        lines.push(`${label}: ${playerName(slot.players[0])}${goalie}`)
      } else {
        const pos = slot.positions?.length === 2
          ? ` (${slot.positions[0] === 'attack' ? 'St' : 'Tor'}/${slot.positions[1] === 'attack' ? 'St' : 'Tor'})`
          : ''
        lines.push(`${label}: ${playerName(slot.players[0])} + ${playerName(slot.players[1] ?? '?')}${pos}`)
      }
    })
    lines.push('', 'Erstellt mit Hornstrike 🦄')
    const text = lines.join('\n')

    if (navigator.share) {
      await navigator.share({ title: 'Hornstrike Aufstellung', text })
    } else {
      // Fallback: textarea + execCommand (funktioniert auch ohne HTTPS)
      try {
        if (navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(text)
        } else {
          const el = document.createElement('textarea')
          el.value = text
          el.style.cssText = 'position:fixed;opacity:0;top:0;left:0'
          document.body.appendChild(el)
          el.select()
          document.execCommand('copy')
          document.body.removeChild(el)
        }
        alert('Aufstellung in Zwischenablage kopiert ✓')
      } catch {
        // Letzter Ausweg: Text in Dialog anzeigen zum manuellen Kopieren
        prompt('Aufstellung kopieren (Strg+A, Strg+C):', text)
      }
    }
  }

  const regenerate = () => {
    const lineup = generateLineup(players, matchDay.players, matchDay.useGoalie ?? true, matchDay.useFifthDouble ?? false)
    updateMatchDay({ ...matchDay, lineup })
    setAnimKey(k => k + 1)
  }

  const updateSlot = (slot: GameSlot) => {
    const lineup = matchDay.lineup.map(s => s.gameIndex === slot.gameIndex ? slot : s)
    updateMatchDay({ ...matchDay, lineup })
    setEditingSlot(null)
  }

  const gameSequence = getGameSequence(matchDay.useFifthDouble ?? false)
  const visibleGames = gameSequence

  // drag id format: "g{gameIndex}-p{playerIndex}"
  const parseDragId = (id: string) => {
    const m = String(id).match(/^g(\d+)-p(\d+)$/)
    return m ? { gameIndex: parseInt(m[1]), playerIndex: parseInt(m[2]) } : null
  }

  const handleDragStart = (e: DragStartEvent) => {
    const parsed = parseDragId(String(e.active.id))
    if (!parsed) return
    const slot = matchDay.lineup.find(s => s.gameIndex === parsed.gameIndex)
    const pid = slot?.players[parsed.playerIndex]
    setDragLabel(pid ? playerName(pid) : null)
  }

  const handleDragEnd = (e: DragEndEvent) => {
    setDragLabel(null)
    const from = parseDragId(String(e.active.id))
    const to = parseDragId(String(e.over?.id ?? ''))
    if (!from || !to || (from.gameIndex === to.gameIndex && from.playerIndex === to.playerIndex)) return

    const lineup = matchDay.lineup.map(s => ({ ...s, players: [...s.players], positions: s.positions ? [...s.positions] : [] }))
    const fromSlot = lineup.find(s => s.gameIndex === from.gameIndex)
    const toSlot = lineup.find(s => s.gameIndex === to.gameIndex)
    if (!fromSlot || !toSlot) return

    const fromPid = fromSlot.players[from.playerIndex]
    const toPid = toSlot.players[to.playerIndex]
    if (fromPid === undefined) return

    if (toPid !== undefined) {
      // Swap
      fromSlot.players[from.playerIndex] = toPid
      toSlot.players[to.playerIndex] = fromPid
    } else {
      // Verschieben (target slot hat weniger Spieler)
      toSlot.players[to.playerIndex] = fromPid
      fromSlot.players.splice(from.playerIndex, 1)
    }
    updateMatchDay({ ...matchDay, lineup })
  }

  return (
    <div className="min-h-screen bg-unicorn-purple pb-24">
      <div className="absolute w-[350px] h-[350px] rounded-full bg-unicorn-pink/22 blur-[120px] top-0 right-0 pointer-events-none" />

      <Header
        title="Aufstellung"
        back="/matchday"
        right={
          <div className="flex gap-2">
            <button
              onClick={share}
              className="flex items-center gap-1 bg-[#391060] border border-white/20 text-white/60 text-sm font-semibold px-3 py-1.5 rounded-full"
              title="Aufstellung teilen"
            >
              ↑
            </button>
            <button
              onClick={() => navigate(`/matchday/${matchDay.id}/edit`)}
              className="flex items-center gap-1 bg-[#391060] border border-white/20 text-white/60 text-sm font-semibold px-3 py-1.5 rounded-full"
            >
              ✎
            </button>
            <button
              onClick={regenerate}
              className="flex items-center gap-1.5 bg-[#391060] border border-unicorn-cyan/50 text-unicorn-cyan text-sm font-semibold px-3 py-1.5 rounded-full"
            >
              ⟳ Neu
            </button>
          </div>
        }
      />

      {/* Match info */}
      <div className="relative px-6 mb-4">
        <div className="bg-[#2b0b4c] rounded-xl px-4 py-2.5 flex items-center justify-between">
          <div>
            <span className="text-white/60 text-sm">{formatDate(matchDay.date)}</span>
            {matchDay.opponent && (
              <span className="text-white/60 text-sm"> · vs. <span className="text-unicorn-cyan font-medium">{matchDay.opponent}</span></span>
            )}
          </div>
          <span className="text-white/60 text-sm">{matchDay.players.length} Spieler</span>
        </div>
      </div>

      {/* Sets-Übersicht */}
      {setEntries.length > 0 && (
        <div className="relative px-6 mb-3">
          <div className="bg-[#2b0b4c] rounded-xl px-4 py-3">
            <p className="text-white/40 text-[11px] font-semibold tracking-wider uppercase mb-2">Sätze pro Spieler</p>
            <div className="flex flex-wrap gap-x-4 gap-y-1.5">
              {setEntries.map(([pid, sets]) => (
                <div key={pid} className="flex items-center gap-1.5">
                  <span className="text-white/70 text-[13px]">{playerName(pid)}</span>
                  <span className={`text-[12px] font-bold px-1.5 py-0.5 rounded ${
                    sets > 6 ? 'bg-amber-500/20 text-amber-300' : 'bg-unicorn-cyan/15 text-unicorn-cyan'
                  }`}>{sets}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Game rows with DnD */}
      <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div key={animKey} className="relative px-6 space-y-1.5">
          {visibleGames.map((game, idx) => {
            const slot = matchDay.lineup.find(s => s.gameIndex === game.gameIndex)
            const label = GAME_LABELS[idx] ?? `${game.type === 'singles' ? 'E' : 'D'}?`
            const isDouble = game.type === 'doubles'
            const isEmpty = !slot || slot.players.length === 0
            const pillAccent = isDouble ? 'bg-unicorn-pink/20 text-unicorn-pink' : 'bg-unicorn-cyan/20 text-unicorn-cyan'

            return (
              <motion.div
                key={game.gameIndex}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.03 }}
                className={`w-full rounded-xl px-3 py-2 flex items-center gap-2 border-l-[3px] ${
                  slot?.forfeit
                    ? 'bg-white/3 border-white/15 opacity-50'
                    : violatingIndices.has(game.gameIndex)
                      ? 'bg-amber-900/25 border-amber-400/70'
                      : isDouble
                        ? 'bg-[#2b0b4c] border-unicorn-pink'
                        : 'bg-[#2b0b4c] border-unicorn-cyan'
                }`}
              >
                {/* Label badge */}
                <span className={`text-[11px] font-bold w-8 text-center py-0.5 rounded-md flex-shrink-0 ${
                  isDouble ? 'bg-unicorn-pink/15 text-unicorn-pink' : 'bg-unicorn-cyan/15 text-unicorn-cyan'
                }`}>
                  {label}
                </span>

                {/* Player pills */}
                {slot?.forfeit ? (
                  <span className="flex-1 text-white/30 text-sm italic">Kampflos</span>
                ) : isEmpty ? (
                  <DroppableSlot id={`g${game.gameIndex}-p0`}>
                    <span className="text-white/25 text-[12px] italic">Nicht besetzt</span>
                  </DroppableSlot>
                ) : (
                  <div className="flex-1 flex flex-wrap gap-1 items-center">
                    {slot.players.map((pid, pi) => (
                      <DroppableSlot key={pi} id={`g${game.gameIndex}-p${pi}`}>
                        <DraggablePill id={`g${game.gameIndex}-p${pi}`} label={playerName(pid)} accent={pillAccent} />
                        {isDouble && slot.positions?.[pi] && (
                          <span className="text-white/35 text-[10px] mr-1">
                            {slot.positions[pi] === 'attack' ? 'St' : 'To'}
                          </span>
                        )}
                      </DroppableSlot>
                    ))}
                  </div>
                )}

                {/* Goalie badge */}
                {slot?.isGoalieSingles && (
                  <span className="text-[10px] font-semibold bg-unicorn-gold/15 text-unicorn-gold px-1.5 py-0.5 rounded-md flex-shrink-0">
                    🥅
                  </span>
                )}

                {!slot?.forfeit && (
                  <button onClick={() => setEditingSlot(game.gameIndex)} className="text-white/20 text-sm flex-shrink-0 pl-1">✎</button>
                )}
              </motion.div>
            )
          })}
        </div>

        <DragOverlay dropAnimation={null}>
          {dragLabel && (
            <span className="inline-flex items-center px-3 py-1 rounded-full text-[13px] font-semibold bg-unicorn-pink text-white shadow-xl shadow-unicorn-pink/50">
              {dragLabel}
            </span>
          )}
        </DragOverlay>
      </DndContext>

      {/* Validation banner */}
      <AnimatePresence>
        {violations.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
            className="fixed bottom-20 left-4 right-4 z-30 bg-amber-900/80 backdrop-blur-sm border border-amber-500/40 rounded-2xl px-4 py-3"
          >
            <p className="text-amber-300 text-[12px] font-bold tracking-wider uppercase mb-1.5">⚠ Regelverstoß</p>
            {violations.map((v, i) => (
              <p key={i} className="text-amber-200/80 text-[13px] leading-snug">· {v.message}</p>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      <BottomNav />

      <AnimatePresence>
        {editingSlot !== null && (
          <LineupDetailModal
            gameIndex={editingSlot}
            slot={matchDay.lineup.find(s => s.gameIndex === editingSlot) ?? null}
            matchDayPlayers={matchDay.players}
            allPlayers={players}
            gameLabel={GAME_LABELS[gameSequence.findIndex(g => g.gameIndex === editingSlot)] ?? ''}
            onSave={updateSlot}
            onClose={() => setEditingSlot(null)}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
