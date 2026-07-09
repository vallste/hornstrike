import { forwardRef } from 'react'
import type { MatchDay, Player } from '../types'
import { getGameSequence, isGoalieGameIndex } from '../types'

const PLAYER_COLORS = [
  '#ffd700', '#fb923c', '#34d399', '#38bdf8',
  '#a3e635', '#fb7185', '#8b5cf6', '#14b8a6',
]

interface Props {
  matchDay: MatchDay
  players: Player[]
}

const LineupShareCard = forwardRef<HTMLDivElement, Props>(({ matchDay, players }, ref) => {
  const gameSequence = getGameSequence(matchDay.useFifthDouble ?? false)

  const playerName = (pid: string) => players.find(p => p.id === pid)?.name ?? '?'
  const playerColor = (pid: string) => {
    const idx = players.findIndex(p => p.id === pid)
    return PLAYER_COLORS[(idx >= 0 ? idx : 0) % PLAYER_COLORS.length]
  }
  const isGoalie = (slot: { isGoalieSingles?: boolean; gameIndex: number; type: string }) =>
    slot.isGoalieSingles || (!!matchDay.useGoalie && slot.type === 'singles' && isGoalieGameIndex(slot.gameIndex, matchDay.useFifthDouble ?? false))

  const formatDate = (iso: string) =>
    new Date(iso + 'T12:00:00').toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric', month: 'long' })

  const setEntries = (() => {
    const acc: Record<string, number> = {}
    for (const slot of matchDay.lineup) {
      if (slot.forfeit || slot.players.length === 0) continue
      const sets = slot.type === 'singles' ? 1 : 2
      for (const pid of slot.players) acc[pid] = (acc[pid] ?? 0) + sets
    }
    return Object.entries(acc).sort((a, b) => b[1] - a[1])
  })()

  const s = {
    card: {
      width: 360,
      background: '#1a0533',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif',
      padding: 20,
      borderRadius: 16,
    } as React.CSSProperties,
    divider: {
      height: 1,
      background: 'rgba(255,255,255,0.08)',
      margin: '12px 0',
    } as React.CSSProperties,
  }

  return (
    <div ref={ref} style={s.card}>
      {/* Header */}
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 17, fontWeight: 800, color: '#e040fb', letterSpacing: -0.3 }}>
          🦄 Hornstrike
        </div>
        <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.55)', marginTop: 3 }}>
          Fellow Unicorns · {formatDate(matchDay.date)}
          {matchDay.opponent ? ` · vs. ${matchDay.opponent}` : ''}
        </div>
      </div>

      <div style={s.divider} />

      {/* Game rows */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
        {gameSequence.map((game) => {
          const slot = matchDay.lineup.find(s => s.gameIndex === game.gameIndex)
          const label = game.label
          const isDouble = game.type === 'doubles'
          const accent = slot?.forfeit ? 'rgba(255,255,255,0.1)' : isDouble ? '#00e5ff' : '#e040fb'

          return (
            <div key={game.gameIndex} style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '6px 10px',
              background: 'rgba(255,255,255,0.04)',
              borderRadius: 9,
              borderLeft: `3px solid ${accent}`,
            }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.3)', width: 22, flexShrink: 0 }}>
                {label}
              </span>

              {slot?.forfeit || !slot || slot.players.length === 0 ? (
                <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.18)' }}>–</span>
              ) : (
                <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', alignItems: 'center' }}>
                  {slot.players.map(pid => (
                    <span key={pid} style={{
                      fontSize: 12,
                      fontWeight: 600,
                      color: playerColor(pid),
                      background: `${playerColor(pid)}28`,
                      padding: '2px 8px',
                      borderRadius: 20,
                    }}>
                      {playerName(pid)}
                    </span>
                  ))}
                  {isGoalie(slot) && (
                    <span style={{ fontSize: 11 }}>🥅</span>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Sets summary */}
      {setEntries.length > 0 && (
        <>
          <div style={s.divider} />
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 12px' }}>
            {setEntries.map(([pid, sets]) => (
              <span key={pid} style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>
                <span style={{ color: playerColor(pid), fontWeight: 700 }}>{playerName(pid)}</span>
                {' '}{sets} {sets === 1 ? 'Satz' : 'Sätze'}
              </span>
            ))}
          </div>
        </>
      )}

      {/* Branding */}
      <div style={{ marginTop: 12, fontSize: 9, color: 'rgba(255,255,255,0.15)', textAlign: 'right' }}>
        Erstellt mit Hornstrike 🦄
      </div>
    </div>
  )
})

LineupShareCard.displayName = 'LineupShareCard'
export default LineupShareCard
