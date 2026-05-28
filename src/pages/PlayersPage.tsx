import { useNavigate } from 'react-router-dom'
import {
  DndContext, PointerSensor, TouchSensor, useSensor, useSensors,
  type DragEndEvent, closestCenter,
} from '@dnd-kit/core'
import {
  SortableContext, useSortable, verticalListSortingStrategy, arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import Header from '../components/Header'
import Badge from '../components/Badge'
import BottomNav from '../components/BottomNav'
import { usePlayers } from '../store'
import type { Player } from '../types'

const AVATAR_COLORS = ['#00e5ff', '#e040fb', '#ffd700', '#00e5ff', '#7c3aed', '#e040fb', '#ffd700']

function positionColor(pos: string): 'cyan' | 'pink' | 'gold' | 'default' {
  if (pos.includes('attack')) return 'cyan'
  if (pos.includes('defense')) return 'gold'
  return 'default'
}

function positionLabel(pos: Player['preferences']['position']): string {
  const map: Record<typeof pos, string> = {
    attack: 'Sturm', defense: 'Tor',
    attack_preferred: 'Sturm >', defense_preferred: 'Tor >',
    both: 'Beides',
  }
  return map[pos]
}

function gameTypeLabel(t: Player['preferences']['gameType']): string {
  const map: Record<typeof t, string> = {
    singles_only: 'Einzel', doubles_only: 'Doppel',
    singles_preferred: 'Einzel >', doubles_preferred: 'Doppel >',
    both: 'E + D',
  }
  return map[t]
}

// ── Sortierbare Karte ──────────────────────────────────────────────────────

function SortablePlayerCard({ player, idx, onEdit, onDelete }: {
  player: Player
  idx: number
  onEdit: () => void
  onDelete: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: player.id })
  const color = AVATAR_COLORS[idx % AVATAR_COLORS.length]
  const initials = player.name.split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase()

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`bg-[#2b0b4c] rounded-2xl px-4 py-3.5 flex items-center gap-3 transition-shadow ${isDragging ? 'shadow-2xl shadow-unicorn-pink/30 opacity-90 z-10 relative' : ''}`}
    >
      {/* Drag handle */}
      <button
        {...listeners}
        {...attributes}
        className="text-white/20 text-lg flex-shrink-0 cursor-grab active:cursor-grabbing touch-none select-none px-1 -ml-1"
        tabIndex={-1}
        aria-label="Sortieren"
      >
        ⠿
      </button>

      {/* Avatar */}
      <button onClick={onEdit} className="flex items-center gap-3 flex-1 min-w-0 text-left">
        <div
          className="w-10 h-10 rounded-full flex-shrink-0 flex items-center justify-center text-[13px] font-bold"
          style={{ background: `${color}22`, color }}
        >
          {initials}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-white font-semibold text-[15px] truncate">{player.name}</p>
          <div className="flex gap-1.5 mt-1 flex-wrap">
            <Badge label={positionLabel(player.preferences.position)} color={positionColor(player.preferences.position)} />
            <Badge label={gameTypeLabel(player.preferences.gameType)} />
            {player.preferences.goaliePreference && <Badge label="🥅 Goalie" color="gold" />}
          </div>
        </div>
      </button>

      {/* Delete + chevron */}
      <div className="flex items-center gap-1 flex-shrink-0">
        <button
          onClick={e => { e.stopPropagation(); onDelete() }}
          className="text-white/20 hover:text-red-400 text-lg transition-colors p-1"
        >✕</button>
        <button onClick={onEdit} className="text-white/25 text-xl px-1">›</button>
      </div>
    </div>
  )
}

// ── Page ───────────────────────────────────────────────────────────────────

export default function PlayersPage() {
  const navigate = useNavigate()
  const { players, deletePlayer, reorder } = usePlayers()

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
  )

  const handleDragEnd = (e: DragEndEvent) => {
    const { active, over } = e
    if (over && active.id !== over.id) {
      const oldIdx = players.findIndex(p => p.id === active.id)
      const newIdx = players.findIndex(p => p.id === over.id)
      reorder(arrayMove(players, oldIdx, newIdx))
    }
  }

  return (
    <div className="min-h-screen bg-unicorn-purple pb-24">
      <div className="absolute w-[380px] h-[380px] rounded-full bg-unicorn-violet/45 blur-[130px] -top-20 -left-12 pointer-events-none" />

      <Header
        title="Spieler"
        right={
          <button
            onClick={() => navigate('/players/new')}
            className="w-9 h-9 rounded-full bg-unicorn-pink flex items-center justify-center text-white text-2xl font-bold shadow-lg shadow-unicorn-pink/40"
          >+</button>
        }
      />

      <div className="relative px-6 mt-2">
        {players.length === 0 && (
          <div className="bg-[#2b0b4c] rounded-2xl p-6 text-center">
            <p className="text-4xl mb-3">👥</p>
            <p className="text-white font-semibold">Noch keine Spieler</p>
            <p className="text-white/45 text-sm mt-1">Tippe auf + um den ersten Spieler anzulegen.</p>
          </div>
        )}

        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={players.map(p => p.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-3">
              {players.map((player, idx) => (
                <SortablePlayerCard
                  key={player.id}
                  player={player}
                  idx={idx}
                  onEdit={() => navigate(`/players/${player.id}`)}
                  onDelete={() => deletePlayer(player.id)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      </div>

      <BottomNav />
    </div>
  )
}
