import { useState, useMemo, useEffect, useRef } from 'react'
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
import { getGameSequence, isGoalieGameIndex } from '../types'
import type { GameSlot } from '../types'
import LineupDetailModal from './LineupDetailModal'
import LineupShareCard from '../components/LineupShareCard'
import LoadingScreen from '../components/LoadingScreen'


// Farbpalette für Spieler-Pills – bewusst ohne Cyan (#00e5ff) und Pink (#e040fb),
// da diese für Einzel/Doppel-Zeilenborders reserviert sind.
const PILL_COLORS = [
  { bg: 'rgba(255,215,0,0.18)',   text: '#ffd700' },  // gold
  { bg: 'rgba(251,146,60,0.18)',  text: '#fb923c' },  // orange
  { bg: 'rgba(52,211,153,0.18)',  text: '#34d399' },  // emerald
  { bg: 'rgba(56,189,248,0.18)',  text: '#38bdf8' },  // sky (klar ≠ cyan)
  { bg: 'rgba(163,230,53,0.18)',  text: '#a3e635' },  // lime
  { bg: 'rgba(251,113,133,0.18)', text: '#fb7185' },  // rose (klar ≠ pink)
  { bg: 'rgba(139,92,246,0.18)',  text: '#8b5cf6' },  // violet
  { bg: 'rgba(20,184,166,0.18)',  text: '#14b8a6' },  // teal
]

// ── Draggable pill ──────────────────────────────────────────────────────────
function DraggablePill({ id, label, color }: { id: string; label: string; color: { bg: string; text: string } }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id })
  return (
    <span
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      style={{ background: color.bg, color: color.text }}
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[12px] font-semibold cursor-grab active:cursor-grabbing select-none touch-none transition-opacity ${isDragging ? 'opacity-30' : 'opacity-100'}`}
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
  const { matchDays, isLoading } = useMatchDays()
  const matchDay = matchDays.find(m => m.id === id)
  if (isLoading) return <LoadingScreen />
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
  return <LineupView key={matchDay.id} />
}

function LineupView() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { players } = usePlayers()
  const { matchDays, updateMatchDay } = useMatchDays()
  const matchDay = matchDays.find(m => m.id === id)!
  const [editingSlot, setEditingSlot] = useState<number | null>(null)
  const [animKey, setAnimKey] = useState(0)
  const [dragLabel, setDragLabel] = useState<string | null>(null)
  const [dragPlayerId, setDragPlayerId] = useState<string | null>(null)
  const [sequenceMismatchDismissed, setSequenceMismatchDismissed] = useState(false)
  const [shareMenuOpen, setShareMenuOpen] = useState(false)
  const shareCardRef = useRef<HTMLDivElement>(null)
  const [violationsDismissed, setViolationsDismissed] = useState(false)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
  )

  const playerName = (pid: string) => players.find(p => p.id === pid)?.name ?? '?'

  // Konsistente Farbe pro Spieler (Index in der Spielerliste → Farbpalette)
  const playerColor = (pid: string) => {
    const idx = players.findIndex(p => p.id === pid)
    return PILL_COLORS[(idx >= 0 ? idx : 0) % PILL_COLORS.length]
  }

  // Goalie-Status auch für retroaktiv geänderte useGoalie-Einstellung korrekt anzeigen
  const effectiveIsGoalie = (slot: GameSlot) =>
    slot.isGoalieSingles || (!!matchDay.useGoalie && slot.type === 'singles' && isGoalieGameIndex(slot.gameIndex, matchDay.useFifthDouble ?? false))

  const activePlayerIds = matchDay.players.map(p => p.playerId)
  const violations = validateLineup(matchDay.lineup, playerName, activePlayerIds)
  const violatingIndices = new Set(violations.flatMap(v => v.gameIndices))

  // Banner wieder einblenden wenn sich Verstöße geändert haben
  const violationsKey = violations.map(v => v.message).join('|')
  useEffect(() => { setViolationsDismissed(false) }, [violationsKey])

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
    const lines: string[] = [
      `🦄 Hornstrike – Fellow Unicorns`,
      `${formatDate(matchDay.date)}${matchDay.opponent ? ` vs. ${matchDay.opponent}` : ''}`,
      '',
    ]
    gameSequence.forEach((game) => {
      const slot = matchDay.lineup.find(s => s.gameIndex === game.gameIndex)
      const label = game.label
      if (slot?.forfeit) {
        lines.push(`${label}: –`)
        return
      }
      if (!slot || slot.players.length === 0) {
        lines.push(`${label}: (nicht besetzt)`)
        return
      }
      if (game.type === 'singles') {
        const goalie = effectiveIsGoalie(slot) ? ' 🥅' : ''
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

  const shareAsImage = async () => {
    if (!shareCardRef.current) return
    const { toBlob } = await import('html-to-image')
    await document.fonts.ready
    // fontEmbedCSS: '' verhindert den CORS-Fehler beim Lesen von Google Fonts CSS-Regeln;
    // LineupShareCard nutzt ohnehin System-Fonts (inline styles)
    const blob = await toBlob(shareCardRef.current, { pixelRatio: 2, backgroundColor: '#1a0533', fontEmbedCSS: '' })
    if (!blob) return
    const file = new File([blob], 'hornstrike-aufstellung.png', { type: 'image/png' })
    if (navigator.share && navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], title: 'Hornstrike Aufstellung' })
    } else {
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'hornstrike-aufstellung.png'
      a.click()
      URL.revokeObjectURL(url)
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

  // Prüfe ob Spielfolge (Standard vs. D5) mit der gespeicherten Aufstellung übereinstimmt
  const sequenceMismatch = useMemo(() => {
    const currentSeqTypes = new Map(gameSequence.map(g => [g.gameIndex, g.type]))
    return matchDay.lineup.some(s => {
      if (s.forfeit || s.players.length === 0) return false
      const expectedType = currentSeqTypes.get(s.gameIndex)
      return expectedType !== undefined && expectedType !== s.type
    })
  }, [matchDay.lineup, gameSequence])

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
    setDragPlayerId(pid ?? null)
  }

  const handleDragEnd = (e: DragEndEvent) => {
    setDragLabel(null)
    setDragPlayerId(null)
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
          <div className="flex items-center gap-2">
            {violations.length > 0 && (
              <span
                title="Regelverstoß vorhanden"
                className="text-amber-400 text-lg leading-none cursor-pointer"
                onClick={() => setViolationsDismissed(false)}
              >⚠</span>
            )}

            {/* Share-Dropdown */}
            <div className="relative">
              <button
                onClick={() => setShareMenuOpen(v => !v)}
                className="flex items-center gap-1 bg-[#391060] border border-white/20 text-white/60 text-sm font-semibold px-3 py-1.5 rounded-full"
              >
                ↑
              </button>
              {shareMenuOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShareMenuOpen(false)} />
                  <div className="absolute right-0 top-9 z-50 bg-[#2b0b4c] border border-white/10 rounded-xl shadow-xl overflow-hidden min-w-[130px]">
                    <button
                      onClick={() => { setShareMenuOpen(false); share() }}
                      className="flex items-center gap-2 w-full px-4 py-2.5 text-white/70 text-sm hover:bg-white/5 text-left"
                    >
                      <span>↑</span> Als Text
                    </button>
                    <button
                      onClick={() => { setShareMenuOpen(false); shareAsImage() }}
                      className="flex items-center gap-2 w-full px-4 py-2.5 text-white/70 text-sm hover:bg-white/5 text-left border-t border-white/5"
                    >
                      <span>🖼</span> Als Bild
                    </button>
                  </div>
                </>
              )}
            </div>

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
            const label = game.label
            const isDouble = game.type === 'doubles'
            const isEmpty = !slot || slot.players.length === 0

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
                        <DraggablePill id={`g${game.gameIndex}-p${pi}`} label={playerName(pid)} color={playerColor(pid)} />
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
                {slot && effectiveIsGoalie(slot) && (
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
          {dragLabel && dragPlayerId && (
            <span
              style={{ background: playerColor(dragPlayerId).text, color: '#1a0533' }}
              className="inline-flex items-center px-3 py-1 rounded-full text-[13px] font-bold shadow-xl"
            >
              {dragLabel}
            </span>
          )}
        </DragOverlay>
      </DndContext>

      {/* Sequenzwechsel-Banner (Standard ↔ D5) */}
      <AnimatePresence>
        {sequenceMismatch && !sequenceMismatchDismissed && violations.length === 0 && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
            className="fixed bottom-20 left-4 right-4 z-30 bg-amber-900/80 backdrop-blur-sm border border-amber-500/40 rounded-2xl px-4 py-3"
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-amber-300 text-[12px] font-bold tracking-wider uppercase mb-1">⚠ Spielfolge geändert</p>
                <p className="text-amber-200/80 text-[13px]">Aufstellung passt nicht zur aktuellen Spielfolge – bitte neu berechnen oder manuell anpassen.</p>
              </div>
              <button onClick={() => setSequenceMismatchDismissed(true)} className="text-amber-300/60 text-lg leading-none flex-shrink-0 mt-0.5">×</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Validation banner */}
      <AnimatePresence>
        {violations.length > 0 && !violationsDismissed && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
            className="fixed bottom-20 left-4 right-4 z-30 bg-amber-900/80 backdrop-blur-sm border border-amber-500/40 rounded-2xl px-4 py-3"
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-amber-300 text-[12px] font-bold tracking-wider uppercase mb-1.5">⚠ Regelverstoß</p>
                {violations.map((v, i) => (
                  <p key={i} className="text-amber-200/80 text-[13px] leading-snug">· {v.message}</p>
                ))}
              </div>
              <button onClick={() => setViolationsDismissed(true)} className="text-amber-300/60 text-lg leading-none flex-shrink-0 mt-0.5">×</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Off-screen card for image export */}
      <div style={{ position: 'fixed', left: -9999, top: -9999, zIndex: -1, pointerEvents: 'none' }}>
        <LineupShareCard ref={shareCardRef} matchDay={matchDay} players={players} />
      </div>

      <BottomNav />

      <AnimatePresence>
        {editingSlot !== null && (
          <LineupDetailModal
            gameIndex={editingSlot}
            slot={matchDay.lineup.find(s => s.gameIndex === editingSlot) ?? null}
            matchDayPlayers={matchDay.players}
            allPlayers={players}
            gameLabel={gameSequence.find(g => g.gameIndex === editingSlot)?.label ?? ''}
            useFifthDouble={matchDay.useFifthDouble ?? false}
            onSave={updateSlot}
            onClose={() => setEditingSlot(null)}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
