/**
 * Schema-Versionierung für localStorage-Daten.
 * Beim Start der App wird geprüft ob eine Migration nötig ist.
 *
 * So eine neue Migration hinzufügen:
 *   1. SCHEMA_VERSION erhöhen
 *   2. Funktion in `migrations` ergänzen (key = Ausgangsversion)
 */

import type { Player, MatchDay } from '../types'

export const SCHEMA_VERSION = 1

const SCHEMA_KEY = 'hornstrike_schema_version'
const PLAYERS_KEY = 'hornstrike_players'
const MATCHDAYS_KEY = 'hornstrike_matchdays'

function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch { return fallback }
}

function save<T>(key: string, value: T) {
  localStorage.setItem(key, JSON.stringify(value))
}

// ─── Migrations ───────────────────────────────────────────────────────────────
// Jede Funktion transformiert Daten von Version N auf N+1.
// Beispiel für Version 2:
//
// 2: () => {
//   const players = load<Player[]>(PLAYERS_KEY, [])
//   // … Felder umbenennen, hinzufügen, etc.
//   save(PLAYERS_KEY, players)
// },

const migrations: Record<number, () => void> = {
  // Version 1: Bestehende MatchDays ohne useGoalie/useFifthDouble auf defaults setzen
  1: () => {
    const matchDays = load<MatchDay[]>(MATCHDAYS_KEY, [])
    const migrated = matchDays.map(md => ({
      ...md,
      useGoalie: md.useGoalie ?? false,
      useFifthDouble: md.useFifthDouble ?? false,
    }))
    save(MATCHDAYS_KEY, migrated)

    // Spieler: partnerPreferences sicherstellen
    const players = load<Player[]>(PLAYERS_KEY, [])
    const migratedPlayers = players.map(p => ({
      ...p,
      preferences: {
        ...p.preferences,
        partnerPreferences: p.preferences.partnerPreferences ?? [],
      },
    }))
    save(PLAYERS_KEY, migratedPlayers)
  },
}

// ─── Einstiegspunkt ───────────────────────────────────────────────────────────

export function runMigrations(): { migrated: boolean; fromVersion: number } {
  const stored = Number(localStorage.getItem(SCHEMA_KEY) ?? '0')
  if (stored >= SCHEMA_VERSION) return { migrated: false, fromVersion: stored }

  let v = stored
  while (v < SCHEMA_VERSION) {
    const fn = migrations[v + 1]
    if (fn) fn()
    v++
  }

  localStorage.setItem(SCHEMA_KEY, String(SCHEMA_VERSION))
  return { migrated: true, fromVersion: stored }
}
