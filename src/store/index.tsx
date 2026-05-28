import { createContext, useContext, useState, type ReactNode } from 'react'
import type { Player, MatchDay } from '../types'

// ─── Persistence helpers ──────────────────────────────────────────────────────

const PLAYERS_KEY = 'hornstrike_players'
const MATCHDAYS_KEY = 'hornstrike_matchdays'

function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

function save<T>(key: string, value: T): void {
  localStorage.setItem(key, JSON.stringify(value))
}

// ─── Players context ──────────────────────────────────────────────────────────

interface PlayersCtx {
  players: Player[]
  addPlayer: (p: Player) => void
  updatePlayer: (p: Player) => void
  deletePlayer: (id: string) => void
  replaceAll: (list: Player[]) => void
  reorder: (list: Player[]) => void
}

const PlayersContext = createContext<PlayersCtx | null>(null)

export function PlayersProvider({ children }: { children: ReactNode }) {
  const [players, setPlayers] = useState<Player[]>(() => load(PLAYERS_KEY, []))

  const addPlayer = (player: Player) => {
    const next = [...players, player]
    save(PLAYERS_KEY, next)
    setPlayers(next)
  }
  const updatePlayer = (updated: Player) => {
    const next = players.map(p => (p.id === updated.id ? updated : p))
    save(PLAYERS_KEY, next)
    setPlayers(next)
  }
  const deletePlayer = (id: string) => {
    const next = players.filter(p => p.id !== id)
    save(PLAYERS_KEY, next)
    setPlayers(next)
  }

  const replaceAll = (list: Player[]) => { save(PLAYERS_KEY, list); setPlayers(list) }
  const reorder = (list: Player[]) => { save(PLAYERS_KEY, list); setPlayers(list) }

  return (
    <PlayersContext.Provider value={{ players, addPlayer, updatePlayer, deletePlayer, replaceAll, reorder }}>
      {children}
    </PlayersContext.Provider>
  )
}

export function usePlayers() {
  const ctx = useContext(PlayersContext)
  if (!ctx) throw new Error('usePlayers must be inside PlayersProvider')
  return ctx
}

// ─── MatchDays context ────────────────────────────────────────────────────────

interface MatchDaysCtx {
  matchDays: MatchDay[]
  addMatchDay: (md: MatchDay) => void
  updateMatchDay: (md: MatchDay) => void
  deleteMatchDay: (id: string) => void
  replaceAll: (list: MatchDay[]) => void
}

const MatchDaysContext = createContext<MatchDaysCtx | null>(null)

export function MatchDaysProvider({ children }: { children: ReactNode }) {
  const [matchDays, setMatchDays] = useState<MatchDay[]>(() => load(MATCHDAYS_KEY, []))

  const addMatchDay = (md: MatchDay) => {
    const next = [...matchDays, md]
    save(MATCHDAYS_KEY, next)
    setMatchDays(next)
  }
  const updateMatchDay = (updated: MatchDay) => {
    const next = matchDays.map(m => (m.id === updated.id ? updated : m))
    save(MATCHDAYS_KEY, next)
    setMatchDays(next)
  }
  const deleteMatchDay = (id: string) => {
    const next = matchDays.filter(m => m.id !== id)
    save(MATCHDAYS_KEY, next)
    setMatchDays(next)
  }

  const replaceAll = (list: MatchDay[]) => { save(MATCHDAYS_KEY, list); setMatchDays(list) }

  return (
    <MatchDaysContext.Provider value={{ matchDays, addMatchDay, updateMatchDay, deleteMatchDay, replaceAll }}>
      {children}
    </MatchDaysContext.Provider>
  )
}

export function useMatchDays() {
  const ctx = useContext(MatchDaysContext)
  if (!ctx) throw new Error('useMatchDays must be inside MatchDaysProvider')
  return ctx
}
