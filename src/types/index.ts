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

export interface MatchDay {
  id: string
  date: string
  opponent?: string
  useGoalie: boolean
  useFifthDouble: boolean
  players: MatchDayPlayer[]
  lineup: GameSlot[]
  notes?: string
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

/** Torwarteinzel-Erkennung anhand des Labels (E5/E6) – funktioniert für beide
 * Spielfolgen, da sich der gameIndex im D5-Modus verschiebt. */
export function isGoalieGameIndex(gameIndex: number, useFifthDouble: boolean): boolean {
  const game = getGameSequence(useFifthDouble).find(g => g.gameIndex === gameIndex)
  return game?.label === 'E5' || game?.label === 'E6'
}
