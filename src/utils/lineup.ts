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
  jitter: number       // 0 = deterministisch; > 0 streut die Scores (siehe VARIATION_JITTER)
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
 * Satz-basierte Gleichverteilungs-Penalty: wächst stark, sobald jemand über
 * dem Durchschnitt liegt. Einzel = 1 Satz, Doppel = 2 Sätze – dieselbe Einheit
 * wie targetLoad. Gewicht 65 pro Satz Abweichung überwiegt die Präferenz-Boni,
 * sodass Präferenzen nur unter gleich belasteten Personen entscheiden.
 *
 * Das reicht aber nur während des Durchlaufs; was am Ende schiefliegt, räumt
 * rebalanceSets() auf.
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
  const jitter = context.jitter ? (Math.random() - 0.5) * context.jitter : 0
  return preferenceScore(player, slot, position, partner, totalGames) - loadPenalty(player.id, context) + jitter
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

/**
 * Berechnet die Aufstellung. Ohne `jitter` ist das Ergebnis vollständig
 * deterministisch: gleiche Eingaben → exakt gleiche Aufstellung. Für die
 * Erstberechnung ist das gewollt (bestes Ergebnis), für „Neu berechnen" nicht –
 * dafür gibt es generateLineupVariant().
 */
export function generateLineup(
  players: Player[],
  matchDayPlayers: MatchDayPlayer[],
  useGoalie = false,
  useFifthDouble = false,
  jitter = 0,
): GameSlot[] {
  const GAME_SEQUENCE = getGameSequence(useFifthDouble)
  const maxGames = maxGamesForCount(matchDayPlayers.length)

  // Ziel-Last in SÄTZEN je Person – dieselbe Einheit wie loadPenalty().
  // Ein Einzel bringt 1 Satz fuer 1 Person, ein Doppel 2 Saetze fuer 2 Personen,
  // zaehlt also 4 Spieler-Saetze. Bei 12 Spielen sind das 8 + 16 = 24.
  const playableGames = GAME_SEQUENCE.filter(g => g.gameIndex <= maxGames)
  const totalSets = playableGames.reduce((sum, g) => sum + (g.type === 'singles' ? 1 : 4), 0)
  const targetLoad = matchDayPlayers.length > 0 ? totalSets / matchDayPlayers.length : 2

  const context: Context = {
    players,
    matchDayPlayers,
    slots: [],
    singlesCount: {},
    doublesCount: {},
    doublePairs: new Set(),
    targetLoad,
    jitter,
  }

  for (const game of GAME_SEQUENCE) {
    if (game.gameIndex > maxGames) {
      context.slots.push({ gameIndex: game.gameIndex, type: game.type, forfeit: true, players: [], positions: [] })
      continue
    }

    const isGoalie = useGoalie && (game.label === 'E5' || game.label === 'E6')
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
        const [p1, p2, pos1] = bestPair
        context.doublePairs.add(pairKey(p1.id, p2.id))
        context.doublesCount[p1.id] = (context.doublesCount[p1.id] ?? 0) + 1
        context.doublesCount[p2.id] = (context.doublesCount[p2.id] ?? 0) + 1
        // Einheitlich: Sturm (attack) immer zuerst/links, Tor (defense) dahinter.
        const atkFirst = pos1 === 'attack'
        context.slots.push({
          gameIndex: game.gameIndex,
          type: 'doubles',
          players: atkFirst ? [p1.id, p2.id] : [p2.id, p1.id],
          positions: ['attack', 'defense'],
        })
      } else {
        context.slots.push({ gameIndex: game.gameIndex, type: 'doubles', players: [], positions: [] })
      }
    }
  }

  rebalanceSets(context, maxGames)
  return context.slots
}

// ─── Ausgleich der Satzverteilung ────────────────────────────────────────────

/**
 * Saetze je Person aus der fertigen Aufstellung. Einzel = 1, Doppel = 2 –
 * das ist die Zahl, die in der Aufstellung unter „Saetze pro Spieler:in" steht.
 */
function setsByPlayer(context: Context): Record<string, number> {
  const sets: Record<string, number> = {}
  for (const mdp of context.matchDayPlayers) sets[mdp.playerId] = 0
  for (const slot of context.slots) {
    if (slot.forfeit) continue
    const weight = slot.type === 'singles' ? 1 : 2
    for (const pid of slot.players) if (pid in sets) sets[pid] += weight
  }
  return sets
}

/** Streuungsmass: Summe der quadrierten Abweichungen vom Schnitt. 0 = alle gleich. */
function spreadCost(sets: Record<string, number>): number {
  const values = Object.values(sets)
  if (values.length === 0) return 0
  const mean = values.reduce((a, b) => a + b, 0) / values.length
  return values.reduce((sum, v) => sum + (v - mean) ** 2, 0)
}

/** Darf `candidate` in diesem Slot fuer `replacedId` uebernehmen? */
function canTakeOver(candidate: Player, slot: GameSlot, replacedId: string, context: Context): boolean {
  const mdp = context.matchDayPlayers.find(m => m.playerId === candidate.id)
  if (!mdp) return false
  if (slot.gameIndex < mdp.availableFrom || slot.gameIndex > mdp.availableTo) return false
  if (slot.players.includes(candidate.id)) return false
  if (slot.type === 'singles') return (context.singlesCount[candidate.id] ?? 0) < 2
  if ((context.doublesCount[candidate.id] ?? 0) >= 2) return false
  const partner = slot.players.find(id => id !== replacedId)
  // Das aufzuloesende Paar steht unter einem anderen Schluessel – kein Konflikt mit sich selbst.
  return !partner || !context.doublePairs.has(pairKey(candidate.id, partner))
}

function applyTakeOver(slot: GameSlot, replacedId: string, candidate: Player, context: Context): void {
  const index = slot.players.indexOf(replacedId)
  slot.players[index] = candidate.id

  if (slot.type === 'singles') {
    context.singlesCount[replacedId] = (context.singlesCount[replacedId] ?? 1) - 1
    context.singlesCount[candidate.id] = (context.singlesCount[candidate.id] ?? 0) + 1
    return
  }

  const partner = slot.players.find(id => id !== candidate.id)
  context.doublesCount[replacedId] = (context.doublesCount[replacedId] ?? 1) - 1
  context.doublesCount[candidate.id] = (context.doublesCount[candidate.id] ?? 0) + 1
  if (partner) {
    context.doublePairs.delete(pairKey(replacedId, partner))
    context.doublePairs.add(pairKey(candidate.id, partner))

    // Positionen neu bewerten: wer neu im Doppel steht, muss nicht auf die
    // Position der ersetzten Person passen. Sturm bleibt Index 0.
    const a = context.players.find(p => p.id === slot.players[0])
    const b = context.players.find(p => p.id === slot.players[1])
    if (a && b) {
      const asIs   = preferenceScore(a, slot, 'attack',  b, 0) + preferenceScore(b, slot, 'defense', a, 0)
      const swapped = preferenceScore(b, slot, 'attack',  a, 0) + preferenceScore(a, slot, 'defense', b, 0)
      if (swapped > asIs) slot.players = [slot.players[1], slot.players[0]]
    }
  }
}

/**
 * Kreuztausch zweier Personen zwischen einem Einzel und einem Doppel.
 * Noetig, weil das blosse Ersetzen stecken bleibt, sobald beide an ihren
 * Limits haengen: Wer 2 Einzel hat, kann kein drittes uebernehmen, wer
 * 2 Doppel hat, kein drittes – dann bewegt nur noch ein Tausch etwas.
 */
function canExchange(
  x: Player, slotX: GameSlot, y: Player, slotY: GameSlot, context: Context,
): boolean {
  if (x.id === y.id || slotX === slotY) return false
  if (slotX.type === slotY.type) return false            // gleiche Satzzahl, bringt nichts
  if (slotX.players.includes(y.id) || slotY.players.includes(x.id)) return false

  const mdpX = context.matchDayPlayers.find(m => m.playerId === x.id)
  const mdpY = context.matchDayPlayers.find(m => m.playerId === y.id)
  if (!mdpX || !mdpY) return false
  if (slotY.gameIndex < mdpX.availableFrom || slotY.gameIndex > mdpX.availableTo) return false
  if (slotX.gameIndex < mdpY.availableFrom || slotX.gameIndex > mdpY.availableTo) return false

  // Limits fuer den jeweils NEUEN Spieltyp – der alte wird ja frei.
  const intoDoubles = slotX.type === 'singles' ? x : y
  const intoSingles = slotX.type === 'singles' ? y : x
  if ((context.doublesCount[intoDoubles.id] ?? 0) >= 2) return false
  if ((context.singlesCount[intoSingles.id] ?? 0) >= 2) return false

  // Genau einer der beiden Slots ist ein Doppel – nur dort gibt es ein Paar.
  const doublesSlot = slotX.type === 'doubles' ? slotX : slotY
  const leaving = slotX.type === 'doubles' ? x.id : y.id
  const partner = doublesSlot.players.find(id => id !== leaving)
  return !partner || !context.doublePairs.has(pairKey(intoDoubles.id, partner))
}

/**
 * Nachbesserung nach dem Greedy-Durchlauf: gleicht die Satzverteilung aus.
 *
 * Warum noetig: der Durchlauf entscheidet Spiel fuer Spiel und sieht nicht,
 * was am Ende uebrig bleibt. Die letzten Partien (E7/E8/D4) treffen dann auf
 * einen Rest, der durch die Limits (max. 2 Einzel, 2 Doppel, jedes Paar nur
 * einmal) kaum noch Wahl laesst – so entstand regelmaessig 3/4/4/4/4/5,
 * obwohl bei sechs Personen 4/4/4/4/4/4 moeglich ist.
 *
 * Verfahren: wiederholt den einen Wechsel suchen, der die Streuung am
 * staerksten senkt, und ihn anwenden. Unter gleich guten Wechseln entscheidet
 * die Praeferenz (plus Jitter, damit „Neu berechnen" verschiedene, aber
 * gleich ausgeglichene Aufstellungen liefert). Endet, sobald kein Wechsel die
 * Verteilung mehr verbessert – ein theoretisches Optimum wird nicht erzwungen,
 * denn Verfuegbarkeiten und Limits koennen es unmoeglich machen.
 */
function rebalanceSets(context: Context, totalGames: number): void {
  const byId = new Map(context.players.map(p => [p.id, p]))

  // Obergrenze rein als Sicherheitsnetz – jede Runde senkt die Streuung echt,
  // die Schleife endet in der Praxis nach wenigen Durchlaeufen von selbst.
  for (let round = 0; round < 40; round++) {
    const sets = setsByPlayer(context)
    const cost = spreadCost(sets)
    if (cost === 0) return

    let best: {
      kind: 'replace' | 'exchange'
      slot: GameSlot; replacedId: string; candidate: Player
      otherSlot?: GameSlot; otherId?: string
      gain: number; tiebreak: number
    } | null = null

    for (const slot of context.slots) {
      if (slot.forfeit || slot.players.length === 0) continue
      const weight = slot.type === 'singles' ? 1 : 2

      for (const replacedId of slot.players) {
        for (const mdp of context.matchDayPlayers) {
          if (mdp.playerId === replacedId) continue
          const candidate = byId.get(mdp.playerId)
          if (!candidate || !(replacedId in sets) || !(candidate.id in sets)) continue

          const trial = { ...sets }
          trial[replacedId] -= weight
          trial[candidate.id] += weight
          const gain = cost - spreadCost(trial)
          if (gain <= 0) continue
          if (!canTakeOver(candidate, slot, replacedId, context)) continue

          const position: 'attack' | 'defense' = slot.type === 'doubles'
            ? (slot.positions?.[slot.players.indexOf(replacedId)] ?? 'attack')
            : 'attack'
          const partner = slot.type === 'doubles'
            ? (byId.get(slot.players.find(id => id !== replacedId) ?? '') ?? null)
            : null
          // Feinauswahl: was der Wechsel praeferenzseitig netto kostet oder bringt –
          // wer hineinkommt, minus wer weichen muss. Sonst wuerde ein Wechsel
          // bevorzugt, der zwar gut fuer die neue Person ist, aber einen
          // erfuellten Partnerwunsch zerreisst.
          const leaving = byId.get(replacedId)
          const jitter = context.jitter ? (Math.random() - 0.5) * context.jitter : 0
          const tiebreak =
            preferenceScore(candidate, slot, position, partner, totalGames)
            - (leaving ? preferenceScore(leaving, slot, position, partner, totalGames) : 0)
            + jitter

          if (!best || gain > best.gain || (gain === best.gain && tiebreak > best.tiebreak)) {
            best = { kind: 'replace', slot, replacedId, candidate, gain, tiebreak }
          }
        }
      }
    }

    // Zweiter Zugtyp: Kreuztausch Einzel ↔ Doppel zwischen zwei Personen.
    for (const slotX of context.slots) {
      if (slotX.forfeit || slotX.players.length === 0) continue
      const weightX = slotX.type === 'singles' ? 1 : 2
      for (const xId of slotX.players) {
        const x = byId.get(xId)
        if (!x || !(xId in sets)) continue
        for (const slotY of context.slots) {
          if (slotY.forfeit || slotY.players.length === 0 || slotY.type === slotX.type) continue
          const weightY = slotY.type === 'singles' ? 1 : 2
          for (const yId of slotY.players) {
            const y = byId.get(yId)
            if (!y || !(yId in sets)) continue

            const trial = { ...sets }
            trial[xId] += weightY - weightX
            trial[yId] += weightX - weightY
            const gain = cost - spreadCost(trial)
            if (gain <= 0) continue
            if (!canExchange(x, slotX, y, slotY, context)) continue

            const jitter = context.jitter ? (Math.random() - 0.5) * context.jitter : 0
            const tiebreak =
              preferenceScore(x, slotY, 'attack', null, totalGames)
              + preferenceScore(y, slotX, 'attack', null, totalGames)
              - preferenceScore(x, slotX, 'attack', null, totalGames)
              - preferenceScore(y, slotY, 'attack', null, totalGames)
              + jitter

            if (!best || gain > best.gain || (gain === best.gain && tiebreak > best.tiebreak)) {
              best = { kind: 'exchange', slot: slotX, replacedId: xId, candidate: y, otherSlot: slotY, otherId: yId, gain, tiebreak }
            }
          }
        }
      }
    }

    if (!best) return
    if (best.kind === 'exchange' && best.otherSlot && best.otherId) {
      const x = byId.get(best.replacedId)
      if (!x) return
      applyTakeOver(best.slot, best.replacedId, best.candidate, context)
      applyTakeOver(best.otherSlot, best.otherId, x, context)
    } else {
      applyTakeOver(best.slot, best.replacedId, best.candidate, context)
    }
  }
}

// ─── Variante (für „Neu berechnen") ──────────────────────────────────────────

/**
 * Streuung der Scores für eine Variante. Gemessen an einem 6er-Kader:
 *
 *   Jitter |  versch. Aufstellungen /20  |  Satz-Spanne  |  Positionswunsch
 *        0 |          1                  |       0       |       88 %
 *        4 |         20                  |       0       |       94 %
 *       12 |         20                  |       0       |       90 %
 *       40 |         20                  |       0       |       75 %
 *
 * 4 reicht also für jedes Mal eine andere Aufstellung, ohne dass Präferenzen
 * leiden. Die Satzverteilung bleibt in jedem Fall unberührt, weil
 * rebalanceSets() nach dem Durchlauf ohnehin ausgleicht – der Jitter entscheidet
 * nur, WER die Sätze bekommt, nicht wie viele. Größere Werte kosten nur
 * Qualität, ohne mehr Abwechslung zu bringen.
 */
export const VARIATION_JITTER = 4

/**
 * Wie generateLineup, aber bewusst mit Abwechslung: Ergibt sich zufällig exakt
 * die übergebene `current`-Aufstellung, wird neu gewürfelt. Eine Berechnung
 * kostet < 1 ms, die Wiederholungen fallen also nicht ins Gewicht.
 *
 * Die Spielregeln (max. 2 Einzel / 2 Doppel, jedes Doppel-Paar nur einmal,
 * Verfügbarkeiten) gelten unverändert – der Jitter wirkt nur auf die Auswahl
 * unter den erlaubten Kandidaten.
 */
export function generateLineupVariant(
  players: Player[],
  matchDayPlayers: MatchDayPlayer[],
  useGoalie = false,
  useFifthDouble = false,
  current: GameSlot[] | null = null,
  attempts = 6,
): GameSlot[] {
  const before = current ? JSON.stringify(current) : null
  let lineup = generateLineup(players, matchDayPlayers, useGoalie, useFifthDouble, VARIATION_JITTER)
  for (let i = 1; i < attempts && before !== null && JSON.stringify(lineup) === before; i++) {
    lineup = generateLineup(players, matchDayPlayers, useGoalie, useFifthDouble, VARIATION_JITTER)
  }
  return lineup
}
