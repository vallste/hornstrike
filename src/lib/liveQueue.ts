import { getSupabase, isSupabaseConfigured } from './supabase'
import { uuid } from '../utils/uuid'
import type {
  EventKind, EventSide, GoalRole, MatchDayStatus, OpponentSlot, SetNo,
} from '../types'

// Dauerhafte Warteschlange für die Live-Erfassung.
//
// Warum nicht react-query: dessen pausierte Mutationen liegen im
// Arbeitsspeicher und laufen beim Fortsetzen PARALLEL. Beides geht hier nicht.
// Ein Tor muss einen Neustart der App überleben, und die Reihenfolge ist Teil
// der Bedeutung – Tor 5 darf nicht vor Tor 4 ankommen, sonst stimmt die
// Position im Satz nicht mehr (siehe 0017_live_sync.sql).
//
// Also: eine Liste in localStorage, strikt der Reihe nach abgearbeitet, mit
// wachsenden Abständen. Aufgegeben wird nur, wenn der Server die Eingabe
// ausdrücklich ablehnt oder sie nach vielen Versuchen aussichtslos ist – dann
// aber sichtbar, nicht stillschweigend.

const STORAGE_KEY = 'hornstrike.live-queue.v1'
/** Nach so vielen vergeblichen Anläufen gilt eine Eingabe als verloren. */
const MAX_ATTEMPTS = 8
/** Älteres wird beim Laden verworfen – ein Spieltag von letzter Woche hilft niemandem mehr. */
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000
const MAX_OPS = 500

// ── Vorgänge ────────────────────────────────────────────────────────────────

export interface EventBody {
  kind: 'event'
  gameIndex: number
  setNo: SetNo
  /** Die wievielte Eingabe in diesem Satz – vom Client vergeben, siehe 0017. */
  seq: number
  eventKind: EventKind
  side: EventSide
  playerId: string | null
  role: GoalRole | null
  opponentSlot: OpponentSlot | null
  /** Moment des Tippens. Muss mitreisen: die Schlange kann Minuten spaeter senden. */
  occurredAt: string
}
export interface StartSetBody { kind: 'startSet'; gameIndex: number; setNo: SetNo; at: string }
export interface UndoBody     { kind: 'undo'; gameIndex: number; setNo: SetNo; seq: number }
export interface ScoreBody    { kind: 'score'; gameIndex: number; setNo: SetNo; goalsFor: number; goalsAgainst: number }
export interface OpponentBody { kind: 'opponent'; gameIndex: number; slot: OpponentSlot; name: string }
export interface StatusBody   { kind: 'status'; status: MatchDayStatus; lockLineup?: boolean }

export type OpBody = EventBody | StartSetBody | UndoBody | ScoreBody | OpponentBody | StatusBody

export interface QueuedOp {
  /** Zugleich die Ereignis-ID auf dem Server – macht Wiederholungen harmlos. */
  id: string
  matchdayId: string
  createdAt: number
  attempts: number
  lastError?: string
  body: OpBody
}

export interface RejectedOp {
  id: string
  matchdayId: string
  at: number
  reason: string
  body: OpBody
}

export interface QueueState {
  pending: QueuedOp[]
  rejected: RejectedOp[]
  /** Gerade wird gesendet. */
  syncing: boolean
  online: boolean
}

// ── Zustand + Speicher ──────────────────────────────────────────────────────

let state: QueueState = {
  pending: [], rejected: [], syncing: false,
  online: typeof navigator === 'undefined' ? true : navigator.onLine,
}

const listeners = new Set<() => void>()
const notify = () => listeners.forEach(fn => fn())

export function subscribe(fn: () => void): () => void {
  listeners.add(fn)
  return () => { listeners.delete(fn) }
}
export const getQueueState = (): QueueState => state

function persist(): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      pending: state.pending, rejected: state.rejected.slice(-50),
    }))
  } catch { /* Speicher voll oder gesperrt – die Sitzung läuft trotzdem weiter */ }
}

function setState(patch: Partial<QueueState>, save = true): void {
  state = { ...state, ...patch }
  if (save) persist()
  notify()
}

/** Beim Start laden. Mehrfacher Aufruf ist harmlos. */
export function loadQueue(): void {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return
    const parsed = JSON.parse(raw) as { pending?: QueuedOp[]; rejected?: RejectedOp[] }
    const cutoff = Date.now() - MAX_AGE_MS
    const pending = (parsed.pending ?? [])
      .filter(op => op && typeof op.id === 'string' && op.createdAt > cutoff)
      .slice(-MAX_OPS)
    setState({ pending, rejected: parsed.rejected ?? [] }, false)
  } catch { /* unlesbar → mit leerer Liste weiter */ }
}

// ── Einreihen ───────────────────────────────────────────────────────────────

export function enqueue(matchdayId: string, body: OpBody): QueuedOp {
  const op: QueuedOp = { id: uuid(), matchdayId, createdAt: Date.now(), attempts: 0, body }
  setState({ pending: [...state.pending, op].slice(-MAX_OPS) })
  void drain()
  return op
}

export function pendingFor(matchdayId: string | undefined): QueuedOp[] {
  return matchdayId ? state.pending.filter(op => op.matchdayId === matchdayId) : []
}
export function rejectedFor(matchdayId: string | undefined): RejectedOp[] {
  return matchdayId ? state.rejected.filter(op => op.matchdayId === matchdayId) : []
}
export function dismissRejected(matchdayId: string): void {
  setState({ rejected: state.rejected.filter(op => op.matchdayId !== matchdayId) })
}

// ── Senden ──────────────────────────────────────────────────────────────────

type Outcome = { applied: boolean; reason: string | null }

async function send(op: QueuedOp): Promise<Outcome> {
  const sb = getSupabase()
  const b = op.body

  if (b.kind === 'event') {
    const { data, error } = await sb.rpc('record_match_event', {
      p_matchday: op.matchdayId,
      p_game: b.gameIndex, p_set: b.setNo,
      p_kind: b.eventKind, p_side: b.side,
      p_event_id: op.id, p_seq: b.seq,
      p_player: b.playerId, p_role: b.role, p_opponent_slot: b.opponentSlot,
      p_occurred_at: b.occurredAt,
    })
    if (error) throw error
    const res = (data ?? {}) as { applied?: boolean; reason?: string | null }
    return { applied: !!res.applied, reason: res.reason ?? null }
  }

  if (b.kind === 'startSet') {
    const { error } = await sb.rpc('start_match_set', {
      p_matchday: op.matchdayId, p_game: b.gameIndex, p_set: b.setNo, p_at: b.at,
    })
    if (error) throw error
    return { applied: true, reason: null }
  }

  if (b.kind === 'undo') {
    const { data, error } = await sb.rpc('undo_match_event', {
      p_matchday: op.matchdayId, p_game: b.gameIndex, p_set: b.setNo, p_seq: b.seq,
    })
    if (error) throw error
    const res = (data ?? {}) as { applied?: boolean; reason?: string | null }
    return { applied: !!res.applied, reason: res.reason ?? null }
  }

  if (b.kind === 'score') {
    const { error } = await sb.from('matchday_sets').upsert({
      matchday_id: op.matchdayId, game_index: b.gameIndex, set_no: b.setNo,
      goals_for: b.goalsFor, goals_against: b.goalsAgainst,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'matchday_id,game_index,set_no' })
    if (error) throw error
    return { applied: true, reason: null }
  }

  if (b.kind === 'opponent') {
    const name = b.name.trim()
    if (!name) {
      const { error } = await sb.from('matchday_opponents').delete()
        .eq('matchday_id', op.matchdayId).eq('game_index', b.gameIndex).eq('slot', b.slot)
      if (error) throw error
      return { applied: true, reason: null }
    }
    const { error } = await sb.from('matchday_opponents').upsert({
      matchday_id: op.matchdayId, game_index: b.gameIndex, slot: b.slot, name,
    }, { onConflict: 'matchday_id,game_index,slot' })
    if (error) throw error
    return { applied: true, reason: null }
  }

  const patch: Record<string, unknown> = { status: b.status }
  if (b.lockLineup !== undefined) patch.lineup_locked = b.lockLineup
  const { error } = await sb.from('matchdays').update(patch).eq('id', op.matchdayId)
  if (error) throw error
  return { applied: true, reason: null }
}

/**
 * Fehler, bei denen erneutes Senden nichts ändert: fehlende Rechte, verletzte
 * Regeln, ein gelöschter Spieltag. Alles andere gilt als vorübergehend – im
 * Zweifel lieber weiter nachfassen als ein Tor wegwerfen.
 */
function isPermanent(err: unknown): boolean {
  const code = String((err as { code?: unknown })?.code ?? '')
  const message = String((err as { message?: unknown })?.message ?? '')
  if (['42501', '23503', '23502', '23514', '22P02', '42883'].includes(code)) return true
  if (code === 'P0001' && /not authorized|invalid sequence/.test(message)) return true
  return false
}

const backoff = (attempts: number) => Math.min(2000 * 2 ** (attempts - 1), 60_000)

// ── Abarbeiten ──────────────────────────────────────────────────────────────

type Handlers = {
  /** Erfolgreich beim Server angekommen – der Cache darf den Vorgang übernehmen. */
  onApplied?: (op: QueuedOp) => void
  /** Endgültig nicht angenommen. */
  onRejected?: (op: QueuedOp, reason: string) => void
}
let handlers: Handlers = {}
export function setQueueHandlers(next: Handlers): void { handlers = next }

let authorized = false
/** Ohne Anmeldung ergibt Senden keinen Sinn – die Warteschlange wartet dann. */
export function setQueueAuthorized(value: boolean): void {
  if (authorized === value) return
  authorized = value
  if (value) void drain()
}

let draining = false
let timer: ReturnType<typeof setTimeout> | undefined

const canSend = () =>
  authorized && isSupabaseConfigured && (typeof navigator === 'undefined' || navigator.onLine)

function scheduleRetry(delay: number): void {
  if (timer) clearTimeout(timer)
  timer = setTimeout(() => { timer = undefined; void drain() }, delay)
}

export async function drain(): Promise<void> {
  if (draining || !canSend() || state.pending.length === 0) return
  draining = true
  setState({ syncing: true }, false)

  try {
    while (state.pending.length > 0 && canSend()) {
      const op = state.pending[0]
      try {
        const outcome = await send(op)
        // „duplicate" heißt: derselbe Vorgang war schon da – also Erfolg,
        // nur eben von einem früheren Versuch. Der Stand stimmt bereits.
        if (outcome.applied || outcome.reason === 'duplicate') {
          handlers.onApplied?.(op)
        } else {
          const reason = outcome.reason ?? 'rejected'
          handlers.onRejected?.(op, reason)
          setState({
            rejected: [...state.rejected, { id: op.id, matchdayId: op.matchdayId, at: Date.now(), reason, body: op.body }].slice(-50),
          }, false)
        }
        setState({ pending: state.pending.filter(p => p.id !== op.id) })
      } catch (err) {
        const message = String((err as { message?: unknown })?.message ?? err)
        const attempts = op.attempts + 1
        const giveUp = isPermanent(err) || attempts >= MAX_ATTEMPTS

        if (giveUp) {
          handlers.onRejected?.(op, message)
          setState({
            pending: state.pending.filter(p => p.id !== op.id),
            rejected: [...state.rejected, { id: op.id, matchdayId: op.matchdayId, at: Date.now(), reason: message, body: op.body }].slice(-50),
          })
          continue
        }

        // Kopf der Schlange bleibt liegen – die Reihenfolge ist Teil der Bedeutung.
        setState({
          pending: state.pending.map(p => (p.id === op.id ? { ...p, attempts, lastError: message } : p)),
        })
        scheduleRetry(backoff(attempts))
        return
      }
    }
  } finally {
    draining = false
    setState({ syncing: false }, false)
  }
}

// ── Verbindung beobachten ───────────────────────────────────────────────────

if (typeof window !== 'undefined') {
  const sync = () => {
    setState({ online: navigator.onLine }, false)
    if (navigator.onLine) void drain()
  }
  window.addEventListener('online', sync)
  window.addEventListener('offline', sync)
  // Zurück aus dem Hintergrund: iOS friert Timer ein, hier hilft nur nachsehen.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void drain()
  })
}
