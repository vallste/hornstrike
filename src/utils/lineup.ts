import type { Player, MatchDayPlayer, GameSlot } from '../types'
import { getGameSequence } from '../types'

interface Context {
  players: Player[]
  matchDayPlayers: MatchDayPlayer[]
  slots: GameSlot[]
  singlesCount: Record<string, number>
  doublesCount: Record<string, number>
  doublePairs: Set<string>
  targetLoad: number   // Ziel-Spielanzahl pro Spieler (für Gleichverteilung)
}

function pairKey(a: string, b: string) {
  return [a, b].sort().join('|')
}

// ─── Scoring ──────────────────────────────────────────────────────────────────

function preferenceScore(
  player: Player,
  slot: GameSlot,
  position: 'attack' | 'defense',
  partner: Player | null,
  totalGames: number,
): number {
  let score = 0
  const prefs = player.preferences
  const isSingles = slot.type === 'singles'

  // Position
  if (prefs.position === position)                                          score += 10
  else if (prefs.position === 'both')                                       score += 5
  else if (prefs.position === 'attack_preferred' && position === 'attack')  score += 8
  else if (prefs.position === 'defense_preferred' && position === 'defense') score += 8
  else if (prefs.position === 'attack_preferred' || prefs.position === 'defense_preferred') score += 2

  // Goalie – sehr hohe Priorität: Goalie-Präferenz dominiert alle anderen Präferenzen,
  // verliert nur gegen Spieler die bei der Lastverteilung deutlich besser stehen
  if (slot.isGoalieSingles) score += prefs.goaliePreference ? 50 : -20

  // Spieltyp
  if ( isSingles && prefs.gameType === 'singles_only')      score += 8
  if (!isSingles && prefs.gameType === 'doubles_only')      score += 8
  if ( isSingles && prefs.gameType === 'singles_preferred') score += 5
  if (!isSingles && prefs.gameType === 'doubles_preferred') score += 5
  if (prefs.gameType === 'both')                            score += 3
  if ( isSingles && prefs.gameType === 'doubles_only')      score -= 6
  if (!isSingles && prefs.gameType === 'singles_only')      score -= 6

  // Erstes / Letztes Spiel
  const isOpening = slot.gameIndex <= 2
  const isClosing = slot.gameIndex >= totalGames - 1
  if (prefs.avoidsOpening && isOpening) score -= 14
  if (prefs.avoidsClosing && isClosing) score -= 14

  // Partnerwunsch
  if (partner) {
    const pp = prefs.partnerPreferences.find(p => p.playerId === partner.id)
    if (pp) score += pp.weight * 5
  }

  return score
}

/**
 * Gleichverteilungs-Penalty: wächst stark sobald ein Spieler über
 * dem Ziel-Durchschnitt liegt. Verhindert, dass ein bevorzugter Spieler
 * alle Spiele dominiert.
 */
/**
 * Satz-basierte Gleichverteilungs-Penalty.
 * Einzel = 1 Satz, Doppel = 2 Sätze – konsistent mit targetLoad.
 * Gewicht 65 pro Satz Abweichung vom Durchschnitt dominiert alle
 * Präferenz-Boni (max ~45), sodass Gleichverteilung immer Vorrang hat
 * und Präferenzen nur als Tiebreaker unter gleichbelasteten Spielern wirken.
 */
function loadPenalty(playerId: string, context: Context): number {
  const currentSets =
    (context.singlesCount[playerId] ?? 0) * 1 +
    (context.doublesCount[playerId] ?? 0) * 2
  // Abweichung vom Ziel: negativ = weniger als Durchschnitt (Bonus),
  // positiv = mehr als Durchschnitt (Penalty)
  const deviation = currentSets - context.targetLoad
  return deviation * 65
}

function totalScore(
  player: Player,
  slot: GameSlot,
  position: 'attack' | 'defense',
  partner: Player | null,
  context: Context,
  totalGames: number,
): number {
  return preferenceScore(player, slot, position, partner, totalGames) - loadPenalty(player.id, context)
}

// ─── Verfügbarkeits-Filter ────────────────────────────────────────────────────

function availablePlayers(gameIndex: number, type: 'singles' | 'doubles', context: Context): Player[] {
  return context.players.filter(player => {
    const mdp = context.matchDayPlayers.find(m => m.playerId === player.id)
    if (!mdp) return false
    if (gameIndex < mdp.availableFrom || gameIndex > mdp.availableTo) return false
    if (type === 'singles' && (context.singlesCount[player.id] ?? 0) >= 2) return false
    if (type === 'doubles' && (context.doublesCount[player.id] ?? 0) >= 2) return false
    const alreadyInGame = context.slots.some(
      s => s.gameIndex === gameIndex && s.players.includes(player.id)
    )
    return !alreadyInGame
  })
}

// ─── Reduktion bei Unterbesetzung ─────────────────────────────────────────────

function maxGamesForCount(count: number): number {
  if (count >= 4) return 12
  if (count === 3) return 9
  if (count === 2) return 5
  return 0
}

// ─── Hauptfunktion ────────────────────────────────────────────────────────────

export function generateLineup(
  players: Player[],
  matchDayPlayers: MatchDayPlayer[],
  useGoalie = false,
  useFifthDouble = false,
): GameSlot[] {
  const GAME_SEQUENCE = getGameSequence(useFifthDouble)
  const maxGames = maxGamesForCount(matchDayPlayers.length)

  // Ziel-Last: Gesamte Spieler-Slots geteilt durch Spieleranzahl
  // Einzel = 1 Slot, Doppel = 2 Slots
  const playableGames = GAME_SEQUENCE.filter(g => g.gameIndex <= maxGames)
  const totalSlots = playableGames.reduce((sum, g) => sum + (g.type === 'singles' ? 1 : 2), 0)
  const targetLoad = matchDayPlayers.length > 0 ? totalSlots / matchDayPlayers.length : 2

  const context: Context = {
    players,
    matchDayPlayers,
    slots: [],
    singlesCount: {},
    doublesCount: {},
    doublePairs: new Set(),
    targetLoad,
  }

  for (const game of GAME_SEQUENCE) {
    if (game.gameIndex > maxGames) {
      context.slots.push({ gameIndex: game.gameIndex, type: game.type, forfeit: true, players: [], positions: [] })
      continue
    }

    const isGoalie = useGoalie && (game.gameIndex === 7 || game.gameIndex === 8)
    const avail = availablePlayers(game.gameIndex, game.type, context)

    if (game.type === 'singles') {
      if (avail.length === 0) {
        context.slots.push({ gameIndex: game.gameIndex, type: 'singles', isGoalieSingles: isGoalie, players: [], positions: [] })
        continue
      }
      const mockSlot: GameSlot = { gameIndex: game.gameIndex, type: 'singles', isGoalieSingles: isGoalie, players: [], positions: [] }
      const scored = avail
        .map(p => ({ player: p, score: totalScore(p, mockSlot, 'attack', null, context, maxGames) }))
        .sort((a, b) => b.score - a.score)

      const chosen = scored[0].player
      context.singlesCount[chosen.id] = (context.singlesCount[chosen.id] ?? 0) + 1
      context.slots.push({ gameIndex: game.gameIndex, type: 'singles', isGoalieSingles: isGoalie, players: [chosen.id], positions: [] })

    } else {
      if (avail.length < 2) {
        context.slots.push({ gameIndex: game.gameIndex, type: 'doubles', players: [], positions: [] })
        continue
      }

      const mockSlot: GameSlot = { gameIndex: game.gameIndex, type: 'doubles', players: [], positions: [] }
      let bestScore = -Infinity
      let bestPair: [Player, Player, 'attack' | 'defense', 'attack' | 'defense'] | null = null

      for (let i = 0; i < avail.length; i++) {
        for (let j = i + 1; j < avail.length; j++) {
          const p1 = avail[i], p2 = avail[j]
          if (context.doublePairs.has(pairKey(p1.id, p2.id))) continue

          // Teste beide Positions-Kombinationen
          const combos: [number, 'attack' | 'defense', 'attack' | 'defense'][] = [
            [
              totalScore(p1, mockSlot, 'attack',   p2, context, maxGames) +
              totalScore(p2, mockSlot, 'defense',  p1, context, maxGames),
              'attack', 'defense',
            ],
            [
              totalScore(p1, mockSlot, 'defense',  p2, context, maxGames) +
              totalScore(p2, mockSlot, 'attack',   p1, context, maxGames),
              'defense', 'attack',
            ],
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
