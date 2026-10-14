import type { GameSlot, MatchDay, MatchEvent, MatchSet } from '../types'
import { setFinished, setPoints } from '../types'

// Auswertungen über erfasste Ergebnisse (Migration 0016).
//
// Bewusst zwei Klassen von Kennzahlen:
//  – Satz-basiert (Doppel-Harmonie, Einzelbilanzen): braucht nur Satzstände,
//    funktioniert also auch, wenn nie ein einzelnes Tor erfasst wurde.
//  – Ereignis-basiert (Torschützen, Timeout-Wirkung): braucht das Protokoll.
// Alle Funktionen sind rein – die Seite reicht nur Daten hinein.

export interface Balance {
  sets: number
  won: number
  drawn: number
  lost: number
  goalsFor: number
  goalsAgainst: number
}

const emptyBalance = (): Balance => ({ sets: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0 })

/** Nur abgeschlossene Sätze zählen – ein 3:2 mitten im Spiel verzerrt sonst alles. */
function addSet(b: Balance, s: MatchSet): void {
  if (!setFinished(s.goalsFor, s.goalsAgainst)) return
  const [pf, pa] = setPoints(s.goalsFor, s.goalsAgainst)
  b.sets += 1
  b.goalsFor += s.goalsFor
  b.goalsAgainst += s.goalsAgainst
  if (pf > pa) b.won += 1
  else if (pf < pa) b.lost += 1
  else b.drawn += 1
}

/** Satzquote in Prozent; Unentschieden zählen halb. */
export function winRate(b: Balance): number {
  return b.sets === 0 ? 0 : (100 * (b.won + b.drawn / 2)) / b.sets
}

export const goalDiff = (b: Balance): number => b.goalsFor - b.goalsAgainst

// ── Satz-basiert ─────────────────────────────────────────────────────────────

export interface PairStat extends Balance {
  key: string
  playerIds: [string, string]
}

/** Wie schlägt sich jedes Doppel-Duo? Braucht kein Tor-Protokoll. */
export function doublesPairStats(matchDays: MatchDay[]): PairStat[] {
  const byPair = new Map<string, PairStat>()

  for (const md of matchDays) {
    for (const slot of md.lineup) {
      if (slot.type !== 'doubles' || slot.players.length !== 2 || slot.forfeit) continue
      const ids = [...slot.players].sort() as [string, string]
      const key = ids.join('|')
      const entry = byPair.get(key) ?? { ...emptyBalance(), key, playerIds: ids }
      for (const s of md.sets ?? []) {
        if (s.gameIndex === slot.gameIndex) addSet(entry, s)
      }
      byPair.set(key, entry)
    }
  }

  return [...byPair.values()].filter(p => p.sets > 0)
}

export interface PlayerStat extends Balance {
  playerId: string
}

/** Einzelbilanz je Spieler. */
export function singlesPlayerStats(matchDays: MatchDay[]): PlayerStat[] {
  const byPlayer = new Map<string, PlayerStat>()

  for (const md of matchDays) {
    for (const slot of md.lineup) {
      if (slot.type !== 'singles' || slot.players.length !== 1 || slot.forfeit) continue
      const playerId = slot.players[0]
      const entry = byPlayer.get(playerId) ?? { ...emptyBalance(), playerId }
      for (const s of md.sets ?? []) {
        if (s.gameIndex === slot.gameIndex) addSet(entry, s)
      }
      byPlayer.set(playerId, entry)
    }
  }

  return [...byPlayer.values()].filter(p => p.sets > 0)
}

// ── Ereignis-basiert ─────────────────────────────────────────────────────────

export interface ScorerStat {
  playerId: string
  goals: number
  attack: number
  defense: number
  ownGoals: number
}

export function scorerStats(events: MatchEvent[]): ScorerStat[] {
  const byPlayer = new Map<string, ScorerStat>()
  const get = (id: string) =>
    byPlayer.get(id) ?? { playerId: id, goals: 0, attack: 0, defense: 0, ownGoals: 0 }

  for (const ev of events) {
    if (ev.kind !== 'goal' || !ev.playerId) continue
    const entry = get(ev.playerId)
    if (ev.role === 'own_goal') {
      entry.ownGoals += 1
    } else {
      entry.goals += 1
      if (ev.role === 'attack') entry.attack += 1
      if (ev.role === 'defense') entry.defense += 1
    }
    byPlayer.set(ev.playerId, entry)
  }

  return [...byPlayer.values()].sort((a, b) => b.goals - a.goals)
}

export interface AfterEventStat {
  /** Wie oft das Ereignis vorkam. */
  count: number
  /** Wem das unmittelbar nächste Tor im selben Satz gehörte. */
  nextUs: number
  nextThem: number
  /** Kein Tor mehr im Satz nach dem Ereignis. */
  nextNone: number
  /** Alle Tore, die im Satz danach noch fielen. */
  restFor: number
  restAgainst: number
}

const emptyAfter = (): AfterEventStat =>
  ({ count: 0, nextUs: 0, nextThem: 0, nextNone: 0, restFor: 0, restAgainst: 0 })

const setKey = (ev: MatchEvent) => `${ev.matchdayId}|${ev.gameIndex}|${ev.setNo}`

/** Ereignisse nach Satz gruppiert und nach Reihenfolge sortiert. */
function bySet(events: MatchEvent[]): MatchEvent[][] {
  const groups = new Map<string, MatchEvent[]>()
  for (const ev of events) {
    const key = setKey(ev)
    const list = groups.get(key) ?? []
    list.push(ev)
    groups.set(key, list)
  }
  return [...groups.values()].map(list => [...list].sort((a, b) => a.seq - b.seq))
}

/**
 * Was passierte im Satz NACH einem bestimmten Ereignis? Damit lässt sich
 * ablesen, ob ein Timeout den Lauf gedreht hat – ohne Kausalität zu behaupten.
 */
function effectAfter(events: MatchEvent[], match: (ev: MatchEvent) => boolean): AfterEventStat {
  const stat = emptyAfter()

  for (const group of bySet(events)) {
    group.forEach((ev, i) => {
      if (!match(ev)) return
      stat.count += 1
      const following = group.slice(i + 1).filter(e => e.kind === 'goal')
      if (following.length === 0) {
        stat.nextNone += 1
      } else if (following[0].side === 'us') {
        stat.nextUs += 1
      } else {
        stat.nextThem += 1
      }
      for (const goal of following) {
        if (goal.side === 'us') stat.restFor += 1
        else stat.restAgainst += 1
      }
    })
  }

  return stat
}

export function timeoutEffect(events: MatchEvent[], side: 'us' | 'them'): AfterEventStat {
  return effectAfter(events, ev => ev.kind === 'timeout' && ev.side === side)
}

/**
 * Seit der Zwei-Bereiche-Erfassung koennen auch gegnerische Wechsel notiert
 * werden – die duerfen nicht mit den eigenen in einen Topf.
 */
export function switchEffect(events: MatchEvent[], side: 'us' | 'them' = 'us'): AfterEventStat {
  return effectAfter(events, ev => ev.kind === 'switch' && ev.side === side)
}

/**
 * Ab wie vielen Beobachtungen eine Quote überhaupt gezeigt werden sollte.
 * Darunter ist jede Prozentangabe Zufall – die Oberfläche blendet sie ab.
 */
export const MIN_SAMPLE = 5

// ── Einsatzverteilung über die Saison ───────────────────────────────────────

/** Sätze aus einer Aufstellung: Einzel = 1, Doppel = 2 je beteiligter Person. */
export function setsFromLineup(lineup: GameSlot[]): Record<string, number> {
  const acc: Record<string, number> = {}
  for (const slot of lineup) {
    if (slot.forfeit || slot.players.length === 0) continue
    const sets = slot.type === 'singles' ? 1 : 2
    for (const pid of slot.players) acc[pid] = (acc[pid] ?? 0) + sets
  }
  return acc
}

export interface SquadLoad {
  playerId: string
  /** Sätze insgesamt im betrachteten Zeitraum. */
  sets: number
  /** Spieltage, an denen die Person im Kader stand – auch ohne Einsatz. */
  matchdays: number
}

/**
 * Wer kam wie viel zum Einsatz?
 *
 * Gezählt wird die AUFSTELLUNG, nicht das Ergebnis: es geht um die Frage, wer
 * beim nächsten Spieltag Vortritt haben sollte, und dafür zählt, wer am Tisch
 * stand – unabhängig davon, ob der Satz später erfasst wurde.
 *
 * Der Nenner ist „Spieltage im Kader", nicht „Spieltage mit Einsatz". Wer
 * dabei war und nicht spielen durfte, soll den Schnitt nach unten ziehen –
 * genau diese Person ist ja gemeint.
 *
 * Spieltage ohne Aufstellung bleiben außen vor; sie würden jeden Schnitt
 * verwässern, ohne etwas auszusagen.
 */
export function squadLoad(matchDays: MatchDay[], since?: string): SquadLoad[] {
  const byPlayer = new Map<string, SquadLoad>()
  const touch = (id: string) =>
    byPlayer.get(id) ?? { playerId: id, sets: 0, matchdays: 0 }

  for (const md of matchDays) {
    if (since && md.date < since) continue
    const sets = setsFromLineup(md.lineup ?? [])
    if (Object.keys(sets).length === 0) continue

    for (const mdp of md.players ?? []) {
      const entry = touch(mdp.playerId)
      entry.matchdays += 1
      entry.sets += sets[mdp.playerId] ?? 0
      byPlayer.set(mdp.playerId, entry)
    }
    // Aufgestellt, aber nicht im Kader vermerkt – kommt bei Altdaten vor.
    for (const [pid, count] of Object.entries(sets)) {
      if ((md.players ?? []).some(m => m.playerId === pid)) continue
      const entry = touch(pid)
      entry.matchdays += 1
      entry.sets += count
      byPlayer.set(pid, entry)
    }
  }

  return [...byPlayer.values()]
}

export const averageSets = (load: SquadLoad): number =>
  load.matchdays === 0 ? 0 : load.sets / load.matchdays
