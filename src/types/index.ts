export type Position = 'attack' | 'defense' | 'attack_preferred' | 'defense_preferred' | 'both'

export type GameTypePreference =
  | 'singles_only'
  | 'doubles_only'
  | 'singles_preferred'
  | 'doubles_preferred'
  | 'both'

export interface PartnerPreference {
  playerId: string
  weight: 1 | 2 | 3
}

/** Dauerpräferenzen – spieltagsübergreifend gespeichert */
export interface PlayerPreferences {
  position: Position
  gameType: GameTypePreference
  goaliePreference: boolean
  avoidsOpening: boolean   // spielt ungern E1/E2
  avoidsClosing: boolean   // spielt ungern die letzten Spiele
  partnerPreferences: PartnerPreference[]
}

export interface Player {
  id: string
  name: string
  active: boolean   // false = langfristig nicht verfügbar (verletzt, pausiert etc.)
  preferences: PlayerPreferences
  userId?: string | null   // verknüpfter Account (auth.users.id); null = Ghost/nicht beansprucht
  avatarPath?: string | null   // Storage-Pfad des Profilbilds ('players/<uuid>'), nie eine URL
  ligaPlayerId?: number | null // Spieler-ID beim Tischfußballverband Hamburg (nur Zahl, siehe lib/liga.ts)
}

/** Spieltag-spezifische Einstellungen für einen Spieler */
export interface MatchDayPlayer {
  playerId: string
  availableFrom: number  // Spielnummer 1–12
  availableTo: number    // Spielnummer 1–12
}

export type GameType = 'singles' | 'doubles'

export interface GameSlot {
  gameIndex: number          // 1–12
  type: GameType
  isGoalieSingles?: boolean  // E5/E6 als Goalie-Einzel (Liga 2/3/4)
  forfeit?: boolean          // Kampflos für den Gegner
  players: string[]          // Player IDs (1 oder 2)
  positions?: ('attack' | 'defense')[]
}

export type MatchDayStatus = 'planned' | 'live' | 'done'
export type SetNo = 1 | 2

export interface MatchSet {
  gameIndex: number
  setNo: SetNo
  goalsFor: number
  goalsAgainst: number
}

export interface MatchDay {
  id: string
  date: string
  startTime?: string | null   // 'HH:MM'
  location?: string | null
  opponent?: string
  useGoalie: boolean
  useFifthDouble: boolean
  players: MatchDayPlayer[]
  lineup: GameSlot[]
  notes?: string
  /** Gesperrt = Aufstellung steht fest; Änderungen weist auch die DB ab (0014). */
  lineupLocked?: boolean
  status?: MatchDayStatus
  /** Satzstände, mitgeladen für Listen und Übersichten (0016). */
  sets?: MatchSet[]
}

/** Standard-Spielfolge (12 Spiele) */
export const GAME_SEQUENCE: { gameIndex: number; type: GameType; label: string }[] = [
  { gameIndex: 1,  type: 'singles', label: 'E1' },
  { gameIndex: 2,  type: 'singles', label: 'E2' },
  { gameIndex: 3,  type: 'doubles', label: 'D1' },
  { gameIndex: 4,  type: 'singles', label: 'E3' },
  { gameIndex: 5,  type: 'singles', label: 'E4' },
  { gameIndex: 6,  type: 'doubles', label: 'D2' },
  { gameIndex: 7,  type: 'singles', label: 'E5' },
  { gameIndex: 8,  type: 'singles', label: 'E6' },
  { gameIndex: 9,  type: 'doubles', label: 'D3' },
  { gameIndex: 10, type: 'singles', label: 'E7' },
  { gameIndex: 11, type: 'singles', label: 'E8' },
  { gameIndex: 12, type: 'doubles', label: 'D4' },
]

/** Spielfolge mit optionalem 5. Doppel: E3+E4 werden durch D5 ersetzt, an ihrer
 * Stelle zwischen D1 und D2 (11 Spiele). Ende bleibt E7 E8 D4 – keine Doppel-Häufung. */
export const GAME_SEQUENCE_D5: { gameIndex: number; type: GameType; label: string }[] = [
  { gameIndex: 1,  type: 'singles', label: 'E1' },
  { gameIndex: 2,  type: 'singles', label: 'E2' },
  { gameIndex: 3,  type: 'doubles', label: 'D1' },
  { gameIndex: 4,  type: 'doubles', label: 'D5' },
  { gameIndex: 5,  type: 'doubles', label: 'D2' },
  { gameIndex: 6,  type: 'singles', label: 'E5' },
  { gameIndex: 7,  type: 'singles', label: 'E6' },
  { gameIndex: 8,  type: 'doubles', label: 'D3' },
  { gameIndex: 9,  type: 'singles', label: 'E7' },
  { gameIndex: 10, type: 'singles', label: 'E8' },
  { gameIndex: 11, type: 'doubles', label: 'D4' },
]

export function getGameSequence(useFifthDouble: boolean) {
  return useFifthDouble ? GAME_SEQUENCE_D5 : GAME_SEQUENCE
}

/**
 * Doppel einheitlich ordnen: Sturm (attack) immer zuerst/links, Tor (defense)
 * dahinter/rechts. Lässt Einzel und unvollständige/abweichende Slots unberührt.
 * Idempotent – auf Alt-Daten beim Laden anwendbar, ohne Drag&Drop-Indizes zu
 * verfälschen (players und positions werden gemeinsam getauscht).
 */
export function normalizeDoublesOrder(lineup: GameSlot[]): GameSlot[] {
  return lineup.map(s => {
    if (s.type === 'doubles' && s.players.length === 2
        && s.positions?.length === 2 && s.positions[0] !== 'attack' && s.positions[1] === 'attack') {
      return { ...s, players: [s.players[1], s.players[0]], positions: [s.positions[1], s.positions[0]] }
    }
    return s
  })
}

/** Torwarteinzel-Erkennung anhand des Labels (E5/E6) – funktioniert für beide
 * Spielfolgen, da sich der gameIndex im D5-Modus verschiebt. */
export function isGoalieGameIndex(gameIndex: number, useFifthDouble: boolean): boolean {
  const game = getGameSequence(useFifthDouble).find(g => g.gameIndex === gameIndex)
  return game?.label === 'E5' || game?.label === 'E6'
}

// ─── Ergebnisse (Migration 0016) ─────────────────────────────────────────────
// Spielordnung TFVHH 2.6.3: höchstens zehn Tore je Satz, Ende bei 6:4/4:6 oder
// 5:5. Einzel = 1 Satz, Doppel = 2 Sätze → 16 Sätze je Begegnung.

export type EventKind = 'goal' | 'timeout' | 'switch'
export type EventSide = 'us' | 'them'
/** own_goal = eigener Spieler trifft ins eigene Tor → das Tor zählt für 'them'. */
export type GoalRole = 'attack' | 'defense' | 'own_goal'
export type OpponentSlot = 0 | 1

export interface MatchEvent {
  id: string
  matchdayId: string
  gameIndex: number
  setNo: SetNo
  seq: number
  kind: EventKind
  /** Wem das Tor gutgeschrieben wird – nicht zwingend, wer es verursacht hat. */
  side: EventSide
  playerId: string | null
  role: GoalRole | null
  opponentSlot: OpponentSlot | null
}

export interface OpponentName {
  gameIndex: number
  slot: OpponentSlot
  name: string
}

/** Alle Sätze einer Begegnung in Spielreihenfolge – 16, in beiden Spielfolgen. */
export function matchSetSlots(useFifthDouble: boolean): { gameIndex: number; setNo: SetNo }[] {
  return getGameSequence(useFifthDouble).flatMap(g =>
    g.type === 'singles'
      ? [{ gameIndex: g.gameIndex, setNo: 1 as SetNo }]
      : [{ gameIndex: g.gameIndex, setNo: 1 as SetNo }, { gameIndex: g.gameIndex, setNo: 2 as SetNo }],
  )
}

export function setFinished(goalsFor: number, goalsAgainst: number): boolean {
  return goalsFor >= 6 || goalsAgainst >= 6 || goalsFor + goalsAgainst >= 10
}

/** Satzpunkte: Sieg 2, Unentschieden (5:5) je 1, unfertiger Satz 0. */
export function setPoints(goalsFor: number, goalsAgainst: number): [number, number] {
  if (goalsFor >= 6) return [2, 0]
  if (goalsAgainst >= 6) return [0, 2]
  if (goalsFor + goalsAgainst >= 10) return [1, 1]
  return [0, 0]
}

export interface MatchTotals {
  goalsFor: number
  goalsAgainst: number
  pointsFor: number
  pointsAgainst: number
  setsFinished: number
  setsTotal: number
}

export function matchTotals(sets: MatchSet[], useFifthDouble: boolean): MatchTotals {
  const totals: MatchTotals = {
    goalsFor: 0, goalsAgainst: 0, pointsFor: 0, pointsAgainst: 0,
    setsFinished: 0, setsTotal: matchSetSlots(useFifthDouble).length,
  }
  for (const s of sets) {
    totals.goalsFor += s.goalsFor
    totals.goalsAgainst += s.goalsAgainst
    const [pf, pa] = setPoints(s.goalsFor, s.goalsAgainst)
    totals.pointsFor += pf
    totals.pointsAgainst += pa
    if (setFinished(s.goalsFor, s.goalsAgainst)) totals.setsFinished += 1
  }
  return totals
}

/**
 * Wer steht in diesem Satz gerade auf welcher Position? Ausgangslage ist die
 * Aufstellung, jeder protokollierte Positionswechsel dreht sie um. So kostet
 * ein Tor nur einen Tipp – die Rolle ergibt sich.
 */
export function positionsAfterSwitches(
  slot: GameSlot | undefined,
  switchCount: number,
): { playerId: string; role: 'attack' | 'defense' }[] {
  if (!slot || slot.players.length === 0) return []
  if (slot.type === 'singles') return [{ playerId: slot.players[0], role: 'attack' }]
  const flipped = switchCount % 2 === 1
  return slot.players.slice(0, 2).map((playerId, i) => ({
    playerId,
    role: ((i === 0) !== flipped ? 'attack' : 'defense') as 'attack' | 'defense',
  }))
}
