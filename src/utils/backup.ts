import type { Player, MatchDay } from '../types'

export const CURRENT_VERSION = 1

export interface BackupFile {
  version: number
  exportedAt: string
  appName: 'hornstrike'
  players: Player[]
  matchDays: MatchDay[]
}

// ─── Migrations ───────────────────────────────────────────────────────────────
// Jede Migration transformiert Daten von Version N auf N+1.
// Beim Import wird solange migriert bis version === CURRENT_VERSION.

type RawBackup = Record<string, unknown>

const migrations: Record<number, (data: RawBackup) => RawBackup> = {
  // Beispiel für künftige Migrationen:
  // 1: (data) => { ... return { ...data, version: 2 } }
}

function migrate(raw: RawBackup): BackupFile {
  let data = { ...raw }
  let v = (data.version as number) ?? 0
  while (v < CURRENT_VERSION) {
    const fn = migrations[v]
    if (!fn) break
    data = fn(data)
    v = (data.version as number)
  }
  return data as unknown as BackupFile
}

// ─── Export ───────────────────────────────────────────────────────────────────

export function exportBackup(players: Player[], matchDays: MatchDay[]): void {
  const backup: BackupFile = {
    version: CURRENT_VERSION,
    exportedAt: new Date().toISOString(),
    appName: 'hornstrike',
    players,
    matchDays,
  }
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `hornstrike-backup-${new Date().toISOString().split('T')[0]}.json`
  a.click()
  URL.revokeObjectURL(url)
}

// ─── Import ───────────────────────────────────────────────────────────────────

export interface ImportResult {
  ok: boolean
  data?: BackupFile
  error?: string
  migratedFrom?: number
}

export function parseBackup(raw: string): ImportResult {
  try {
    const parsed = JSON.parse(raw) as RawBackup
    if (parsed.appName !== 'hornstrike') {
      return { ok: false, error: 'Keine gültige Hornstrike-Backup-Datei.' }
    }
    const v = (parsed.version as number) ?? 0
    if (v > CURRENT_VERSION) {
      return { ok: false, error: `Backup-Version ${v} ist neuer als die App (v${CURRENT_VERSION}). Bitte App aktualisieren.` }
    }
    const migrated = migrate(parsed)
    if (!Array.isArray(migrated.players) || !Array.isArray(migrated.matchDays)) {
      return { ok: false, error: 'Ungültige Datenstruktur in der Backup-Datei.' }
    }
    return {
      ok: true,
      data: migrated,
      migratedFrom: v < CURRENT_VERSION ? v : undefined,
    }
  } catch {
    return { ok: false, error: 'Datei konnte nicht gelesen werden (kein gültiges JSON).' }
  }
}
