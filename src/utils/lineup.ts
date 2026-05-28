import type { Player, MatchDayPlayer, GameSlot } from '../types'
import { getGameSequence } from '../types'

interface Context {
  players: Player[]
  matchDayPlayers: MatchDayPlayer[]
  slots: GameSlot[]
  singlesCount: Record<string, number>
  doublesCount: Record<string, number>
  doublePairs: Set<string>
}

function pairKey(a: string, b: string) {
  return [a, b].sort().join('|')
}

/** Score für eine Spielerzuweisung: höher = besser */
function scoreAssignment(
  player: Player,
  slot: GameSlot,
  position: 'attack' | 'defense',
  partner: Player | null,
  context: Context,
): number {
  let score = 0
  const prefs = player.preferences

  // Position-Präferenz
  if (prefs.position === position) score += 10
  else if (prefs.position === 'both') score += 5
  else if (
    (prefs.position === 'attack_preferred' && position === 'attack') ||
    (prefs.position === 'defense_preferred' && position === 'defense')
  ) score += 8
  else if (prefs.position === 'attack_preferred' || prefs.position === 'defense_preferred') score += 3

  // Torwart-Präferenz bei Torwarteinzel
  if (slot.isGoalieSingles && prefs.goaliePreference) score += 12
  if (slot.isGoalieSingles && !prefs.goaliePreference) score -= 6

  // Einzel/Doppel-Präferenz
  const isSingles = slot.type === 'singles'
  if ((isSingles && prefs.gameType === 'singles_only') || (!isSingles && prefs.gameType === 'doubles_only')) score += 8
  if ((isSingles && prefs.gameType === 'singles_preferred') || (!isSingles && prefs.gameType === 'doubles_preferred')) score += 6
  if (prefs.gameType === 'both') score += 4
  if ((isSingles && prefs.gameType === 'doubles_preferred') || (!isSingles && prefs.gameType === 'singles_preferred')) score += 1

  // Partner-Präferenz im Doppel
  if (partner) {
    const partnerPref = prefs.partnerPreferences.find(pp => pp.playerId === partner.id)
    if (partnerPref) score += partnerPref.weight * 5
  }

  // Bevorzuge Spieler mit weniger Spielen (Gleichverteilung)
  const totalGames = (context.singlesCount[player.id] ?? 0) + (context.doublesCount[player.id] ?? 0)
  score -= totalGames * 2

  return score
}

/** Gibt Spieler zurück, die für einen Slot verfügbar sind */
function availablePlayers(gameIndex: number, type: 'singles' | 'doubles', context: Context): Player[] {
  return context.players.filter(player => {
    const mdp = context.matchDayPlayers.find(m => m.playerId === player.id)
    if (!mdp) return false
    if (gameIndex < mdp.availableFrom || gameIndex > mdp.availableTo) return false
    if (type === 'singles' && (context.singlesCount[player.id] ?? 0) >= 2) return false
    if (type === 'doubles' && (context.doublesCount[player.id] ?? 0) >= 2) return false
    // Spieler darf nicht schon einem anderen Slot im gleichen Spiel zugewiesen sein
    const alreadyInGame = context.slots.some(s => s.gameIndex === gameIndex && s.players.includes(player.id))
    return !alreadyInGame
  })
}

/** Anzahl aktiver Spieler → maximale Spielanzahl laut Spielordnung */
function maxGamesForCount(count: number): number {
  if (count >= 4) return 12
  if (count === 3) return 9
  if (count === 2) return 5
  return 0
}

/** Berechnet optimale Aufstellung */
export function generateLineup(players: Player[], matchDayPlayers: MatchDayPlayer[], useGoalie = true, useFifthDouble = false): GameSlot[] {
  const GAME_SEQUENCE = getGameSequence(useFifthDouble)
  const context: Context = {
    players,
    matchDayPlayers,
    slots: [],
    singlesCount: {},
    doublesCount: {},
    doublePairs: new Set(),
  }

  const maxGames = maxGamesForCount(matchDayPlayers.length)

  for (const game of GAME_SEQUENCE) {
    // Spiele jenseits des erlaubten Rahmens → kampflos
    if (game.gameIndex > maxGames) {
      context.slots.push({ gameIndex: game.gameIndex, type: game.type, forfeit: true, players: [], positions: [] })
      continue
    }

    const avail = availablePlayers(game.gameIndex, game.type, context)
    const isGoalie = useGoalie && (game.gameIndex === 7 || game.gameIndex === 8) // E5, E6

    if (game.type === 'singles') {
      if (avail.length === 0) {
        context.slots.push({ gameIndex: game.gameIndex, type: 'singles', isGoalieSingles: isGoalie, players: [], positions: [] })
        continue
      }
      // Wähle Spieler mit bestem Score
      const scored = avail.map(p => ({
        player: p,
        score: scoreAssignment(p, { gameIndex: game.gameIndex, type: 'singles', isGoalieSingles: isGoalie, players: [], positions: [] },
          'attack', null, context),
      })).sort((a, b) => b.score - a.score)

      const chosen = scored[0].player
      context.singlesCount[chosen.id] = (context.singlesCount[chosen.id] ?? 0) + 1
      context.slots.push({ gameIndex: game.gameIndex, type: 'singles', isGoalieSingles: isGoalie, players: [chosen.id], positions: [] })

    } else {
      // Doppel: wähle das beste Pärchen
      if (avail.length < 2) {
        context.slots.push({ gameIndex: game.gameIndex, type: 'doubles', players: [], positions: [] })
        continue
      }

      let bestScore = -Infinity
      let bestPair: [Player, Player, 'attack' | 'defense', 'attack' | 'defense'] | null = null

      for (let i = 0; i < avail.length; i++) {
        for (let j = i + 1; j < avail.length; j++) {
          const p1 = avail[i], p2 = avail[j]
          const key = pairKey(p1.id, p2.id)
          if (context.doublePairs.has(key)) continue

          const slot: GameSlot = { gameIndex: game.gameIndex, type: 'doubles', players: [], positions: [] }
          const s1a = scoreAssignment(p1, slot, 'attack', p2, context)
          const s1d = scoreAssignment(p1, slot, 'defense', p2, context)
          const s2a = scoreAssignment(p2, slot, 'attack', p1, context)
          const s2d = scoreAssignment(p2, slot, 'defense', p1, context)

          // Beste Positions-Kombination
          const combos: [number, 'attack' | 'defense', 'attack' | 'defense'][] = [
            [s1a + s2d, 'attack', 'defense'],
            [s1d + s2a, 'defense', 'attack'],
          ]
          const best = combos.sort((a, b) => b[0] - a[0])[0]

          if (best[0] > bestScore) {
            bestScore = best[0]
            bestPair = [p1, p2, best[1], best[2]]
          }
        }
      }

      if (bestPair) {
        const [p1, p2, pos1, pos2] = bestPair
        context.doublePairs.add(pairKey(p1.id, p2.id))
        context.doublesCount[p1.id] = (context.doublesCount[p1.id] ?? 0) + 1
        context.doublesCount[p2.id] = (context.doublesCount[p2.id] ?? 0) + 1
        context.slots.push({ gameIndex: game.gameIndex, type: 'doubles', players: [p1.id, p2.id], positions: [pos1, pos2] })
      } else {
        context.slots.push({ gameIndex: game.gameIndex, type: 'doubles', players: [], positions: [] })
      }
    }
  }

  return context.slots
}
