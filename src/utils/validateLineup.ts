import type { GameSlot } from '../types'

export interface Violation {
  type: 'too_many_singles' | 'too_many_doubles' | 'duplicate_pair'
  message: string
  gameIndices: number[]
}

function pairKey(a: string, b: string) {
  return [a, b].sort().join('|')
}

export function validateLineup(
  slots: GameSlot[],
  playerName: (id: string) => string,
  activePlayerIds?: string[],
): Violation[] {
  const violations: Violation[] = []
  const singlesCount: Record<string, number[]> = {}
  const doublesCount: Record<string, number[]> = {}
  const pairsSeen: Record<string, number[]> = {}

  for (const slot of slots) {
    if (slot.forfeit || slot.players.length === 0) continue

    if (slot.type === 'singles') {
      const pid = slot.players[0]
      singlesCount[pid] = [...(singlesCount[pid] ?? []), slot.gameIndex]
    } else {
      for (const pid of slot.players) {
        doublesCount[pid] = [...(doublesCount[pid] ?? []), slot.gameIndex]
      }
      if (slot.players.length === 2) {
        const key = pairKey(slot.players[0], slot.players[1])
        pairsSeen[key] = [...(pairsSeen[key] ?? []), slot.gameIndex]
      }
    }
  }

  // Spieler in der Aufstellung aber nicht (mehr) aktiv
  if (activePlayerIds) {
    const activeSet = new Set(activePlayerIds)
    const inactiveInLineup: Record<string, number[]> = {}
    for (const slot of slots) {
      if (slot.forfeit) continue
      for (const pid of slot.players) {
        if (!activeSet.has(pid)) {
          inactiveInLineup[pid] = [...(inactiveInLineup[pid] ?? []), slot.gameIndex]
        }
      }
    }
    for (const [pid, indices] of Object.entries(inactiveInLineup)) {
      violations.push({
        type: 'too_many_singles',
        message: `${playerName(pid)} steht in der Aufstellung, ist aber nicht mehr aktiv`,
        gameIndices: indices,
      })
    }
  }

  // Regel: max 2 Einzel pro Spieler
  for (const [pid, indices] of Object.entries(singlesCount)) {
    if (indices.length > 2) {
      violations.push({
        type: 'too_many_singles',
        message: `${playerName(pid)} spielt ${indices.length}× Einzel (max. 2)`,
        gameIndices: indices,
      })
    }
  }

  // Regel: max 2 Doppel pro Spieler
  for (const [pid, indices] of Object.entries(doublesCount)) {
    if (indices.length > 2) {
      violations.push({
        type: 'too_many_doubles',
        message: `${playerName(pid)} spielt ${indices.length}× Doppel (max. 2)`,
        gameIndices: indices,
      })
    }
  }

  // Regel: gleiche Doppelpaarung nur 1× erlaubt
  for (const [key, indices] of Object.entries(pairsSeen)) {
    if (indices.length > 1) {
      const [a, b] = key.split('|')
      violations.push({
        type: 'duplicate_pair',
        message: `${playerName(a)} + ${playerName(b)} spielen ${indices.length}× zusammen (max. 1)`,
        gameIndices: indices,
      })
    }
  }

  return violations
}
