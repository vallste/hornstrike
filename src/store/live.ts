import { useCallback, useMemo, useSyncExternalStore } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getSupabase, isSupabaseConfigured } from '../lib/supabase'
import { useSession } from '../context/SessionProvider'
import { useScope } from '../context/ScopeProvider'
import type {
  EventKind, EventSide, GoalRole, MatchEvent, MatchSet, MatchDayStatus,
  OpponentName, OpponentSlot, SetNo,
} from '../types'
import { setFinished } from '../types'
import {
  enqueue, dismissRejected, getQueueState, subscribe,
  type OpBody, type QueuedOp,
} from '../lib/liveQueue'

// Datenschicht für die Live-Erfassung (Migration 0016).
//
// Sätze, Protokoll und Gegner-Namen hängen an einem einzigen Query-Key. Das ist
// Absicht: beim Tippen wird optimistisch genau ein Cache-Eintrag verändert, und
// ein Rollback bei Fehlern betrifft ebenfalls nur diesen einen.

export interface LiveData {
  sets: MatchSet[]
  events: MatchEvent[]
  opponents: OpponentName[]
}

const EMPTY: LiveData = { sets: [], events: [], opponents: [] }

type SetRow = { game_index: number; set_no: number; goals_for: number; goals_against: number }
type EventRow = {
  id: string; matchday_id: string; game_index: number; set_no: number; seq: number
  kind: EventKind; side: EventSide; player_id: string | null
  role: GoalRole | null; opponent_slot: number | null
}
type OpponentRow = { game_index: number; slot: number; name: string }

const liveKey = (matchdayId: string | undefined) => ['matchLive', matchdayId] as const

async function fetchLive(matchdayId: string): Promise<LiveData> {
  const sb = getSupabase()
  const [sets, events, opponents] = await Promise.all([
    sb.from('matchday_sets').select('game_index,set_no,goals_for,goals_against').eq('matchday_id', matchdayId),
    sb.from('matchday_events').select('id,matchday_id,game_index,set_no,seq,kind,side,player_id,role,opponent_slot')
      .eq('matchday_id', matchdayId).order('game_index').order('set_no').order('seq'),
    sb.from('matchday_opponents').select('game_index,slot,name').eq('matchday_id', matchdayId),
  ])
  if (sets.error) throw sets.error
  if (events.error) throw events.error
  if (opponents.error) throw opponents.error

  return {
    sets: ((sets.data ?? []) as SetRow[]).map(r => ({
      gameIndex: r.game_index, setNo: r.set_no as SetNo,
      goalsFor: r.goals_for, goalsAgainst: r.goals_against,
    })),
    events: ((events.data ?? []) as EventRow[]).map(r => ({
      id: r.id, matchdayId: r.matchday_id, gameIndex: r.game_index, setNo: r.set_no as SetNo, seq: r.seq,
      kind: r.kind, side: r.side, playerId: r.player_id, role: r.role,
      opponentSlot: r.opponent_slot as OpponentSlot | null,
    })),
    opponents: ((opponents.data ?? []) as OpponentRow[]).map(r => ({
      gameIndex: r.game_index, slot: r.slot as OpponentSlot, name: r.name,
    })),
  }
}

// ── Hilfsfunktionen auf dem Cache-Stand ─────────────────────────────────────

const sameSet = (a: { gameIndex: number; setNo: SetNo }, b: { gameIndex: number; setNo: SetNo }) =>
  a.gameIndex === b.gameIndex && a.setNo === b.setNo

export function findSet(data: LiveData, gameIndex: number, setNo: SetNo): MatchSet {
  return data.sets.find(s => sameSet(s, { gameIndex, setNo }))
    ?? { gameIndex, setNo, goalsFor: 0, goalsAgainst: 0 }
}

export function eventsOfSet(data: LiveData, gameIndex: number, setNo: SetNo): MatchEvent[] {
  return data.events.filter(e => sameSet(e, { gameIndex, setNo })).sort((a, b) => a.seq - b.seq)
}

function applyEvent(data: LiveData, ev: MatchEvent): LiveData {
  const sets = data.sets.some(s => sameSet(s, ev))
    ? data.sets.map(s => (sameSet(s, ev) && ev.kind === 'goal'
      ? {
        ...s,
        goalsFor: s.goalsFor + (ev.side === 'us' ? 1 : 0),
        goalsAgainst: s.goalsAgainst + (ev.side === 'them' ? 1 : 0),
      }
      : s))
    : [...data.sets, {
      gameIndex: ev.gameIndex, setNo: ev.setNo,
      goalsFor: ev.kind === 'goal' && ev.side === 'us' ? 1 : 0,
      goalsAgainst: ev.kind === 'goal' && ev.side === 'them' ? 1 : 0,
    }]
  return { ...data, sets, events: [...data.events, ev] }
}

/** Ein bestimmtes Ereignis entfernen – über die Position, nicht „das letzte".
 *  Wichtig fuer die Warteschlange: dort kann zwischen Einreihen und Senden
 *  laengst etwas anderes obenauf liegen. */
function removeEventAt(data: LiveData, gameIndex: number, setNo: SetNo, seq: number): LiveData {
  const target = data.events.find(e => sameSet(e, { gameIndex, setNo }) && e.seq === seq)
  if (!target) return data
  return {
    ...data,
    events: data.events.filter(e => e.id !== target.id),
    sets: data.sets.map(s => (sameSet(s, target) && target.kind === 'goal'
      ? {
        ...s,
        goalsFor: Math.max(0, s.goalsFor - (target.side === 'us' ? 1 : 0)),
        goalsAgainst: Math.max(0, s.goalsAgainst - (target.side === 'them' ? 1 : 0)),
      }
      : s)),
  }
}

/** Naechste freie Position in einem Satz – zaehlt Server-Stand UND Warteschlange. */
export function nextSeq(data: LiveData, gameIndex: number, setNo: SetNo): number {
  return Math.max(0, ...eventsOfSet(data, gameIndex, setNo).map(e => e.seq)) + 1
}

/**
 * Einen wartenden Vorgang auf den Server-Stand legen. Damit zeigt die App
 * genau das, was nach erfolgreichem Senden dastehen wird – und zwar auch nach
 * einem Neustart, weil die Warteschlange auf der Platte liegt.
 */
export function applyQueued(data: LiveData, op: QueuedOp): LiveData {
  const b = op.body

  if (b.kind === 'event') {
    return applyEvent(data, {
      id: op.id, matchdayId: op.matchdayId,
      gameIndex: b.gameIndex, setNo: b.setNo, seq: b.seq,
      kind: b.eventKind, side: b.side,
      playerId: b.playerId, role: b.role, opponentSlot: b.opponentSlot,
    })
  }
  if (b.kind === 'undo') return removeEventAt(data, b.gameIndex, b.setNo, b.seq)
  if (b.kind === 'score') {
    const next: MatchSet = {
      gameIndex: b.gameIndex, setNo: b.setNo, goalsFor: b.goalsFor, goalsAgainst: b.goalsAgainst,
    }
    return {
      ...data,
      sets: data.sets.some(s => sameSet(s, next))
        ? data.sets.map(s => (sameSet(s, next) ? next : s))
        : [...data.sets, next],
    }
  }
  if (b.kind === 'opponent') {
    const name = b.name.trim()
    const rest = data.opponents.filter(o => !(o.gameIndex === b.gameIndex && o.slot === b.slot))
    return { ...data, opponents: name ? [...rest, { gameIndex: b.gameIndex, slot: b.slot, name }] : rest }
  }
  return data
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export interface RecordEventInput {
  gameIndex: number
  setNo: SetNo
  kind: EventKind
  side: EventSide
  playerId?: string | null
  role?: GoalRole | null
  opponentSlot?: OpponentSlot | null
}

/**
 * Live-Daten eines Spieltags: Server-Stand plus alles, was noch in der
 * Warteschlange liegt.
 *
 * Es gibt hier bewusst keine optimistischen Mutationen mehr. Jede Eingabe
 * wandert in die dauerhafte Warteschlange (lib/liveQueue.ts) und wird von dort
 * der Reihe nach gesendet; angezeigt wird Server-Stand + Warteschlange. Das
 * ergibt dieselbe sofortige Rueckmeldung wie vorher, ueberlebt aber einen
 * Neustart der App und behaelt die Reihenfolge bei.
 */
export function useMatchLive(matchdayId: string | undefined) {
  const { session } = useSession()
  const key = liveKey(matchdayId)
  const enabled = isSupabaseConfigured && !!session && !!matchdayId

  const query = useQuery({
    queryKey: key,
    enabled,
    queryFn: () => fetchLive(matchdayId as string),
    // Am Tisch tippt vielleicht jemand anders mit – regelmäßig nachziehen.
    refetchInterval: 30_000,
  })

  const queue = useSyncExternalStore(subscribe, getQueueState, getQueueState)

  const pending = useMemo(
    () => queue.pending.filter(op => op.matchdayId === matchdayId),
    [queue.pending, matchdayId],
  )
  const rejected = useMemo(
    () => queue.rejected.filter(op => op.matchdayId === matchdayId),
    [queue.rejected, matchdayId],
  )

  const data = useMemo(
    () => pending.reduce(applyQueued, query.data ?? EMPTY),
    [query.data, pending],
  )

  /** IDs der noch nicht bestaetigten Ereignisse – die Liste markiert sie. */
  const pendingIds = useMemo(
    () => new Set(pending.filter(op => op.body.kind === 'event').map(op => op.id)),
    [pending],
  )

  /** Ein Statuswechsel wartet noch – die Seite zeigt ihn trotzdem schon. */
  const pendingStatus = useMemo(() => {
    const last = [...pending].reverse().find(op => op.body.kind === 'status')
    return last ? (last.body as { status: MatchDayStatus }).status : null
  }, [pending])

  const push = useCallback((body: OpBody) => {
    if (matchdayId) enqueue(matchdayId, body)
  }, [matchdayId])

  /**
   * Naechste Position – gegen zwei Tipps im selben Render-Durchlauf abgesichert.
   *
   * `data` stammt aus dem Render und ist zwischen zwei schnellen Tipps noch der
   * alte Stand; beide bekaemen dieselbe Position und der Server wuerde das
   * zweite Tor als „schon erfasst" abweisen. Deshalb zusaetzlich der Blick in
   * die Warteschlange, die `enqueue` synchron fortschreibt.
   */
  const claimSeq = useCallback((gameIndex: number, setNo: SetNo) => {
    const queued = getQueueState().pending
      .filter(op => op.matchdayId === matchdayId && op.body.kind === 'event'
        && op.body.gameIndex === gameIndex && op.body.setNo === setNo)
      .map(op => (op.body as { seq: number }).seq)
    return Math.max(nextSeq(data, gameIndex, setNo) - 1, ...queued) + 1
  }, [data, matchdayId])

  return {
    data,
    isLoading: query.isLoading,
    error: query.error as Error | null,

    /** Eingaben, die noch nicht beim Server sind. */
    pendingCount: pending.length,
    pending: pending.length > 0,
    pendingIds,
    pendingStatus,
    /** Vom Server abgelehnt (z. B. schon von jemand anderem erfasst). */
    rejected,
    dismissRejected: () => { if (matchdayId) dismissRejected(matchdayId) },
    syncing: queue.syncing,
    online: queue.online,

    recordEvent: (input: RecordEventInput) => push({
      kind: 'event',
      gameIndex: input.gameIndex, setNo: input.setNo,
      seq: claimSeq(input.gameIndex, input.setNo),
      eventKind: input.kind, side: input.side,
      playerId: input.playerId ?? null,
      role: input.role ?? null,
      opponentSlot: input.opponentSlot ?? null,
    }),
    undoLast: (gameIndex: number, setNo: SetNo) => {
      const inSet = eventsOfSet(data, gameIndex, setNo)
      const last = inSet[inSet.length - 1]
      if (!last) return
      // Zweimal schnell getippt: dieselbe Position nicht doppelt zuruecknehmen.
      const alreadyQueued = getQueueState().pending.some(op =>
        op.matchdayId === matchdayId && op.body.kind === 'undo'
        && op.body.gameIndex === gameIndex && op.body.setNo === setNo
        && (op.body as { seq: number }).seq === last.seq)
      if (alreadyQueued) return
      push({ kind: 'undo', gameIndex, setNo, seq: last.seq })
    },
    setScore: (input: MatchSet) => push({
      kind: 'score', gameIndex: input.gameIndex, setNo: input.setNo,
      goalsFor: input.goalsFor, goalsAgainst: input.goalsAgainst,
    }),
    setOpponent: (input: OpponentName) => push({
      kind: 'opponent', gameIndex: input.gameIndex, slot: input.slot, name: input.name,
    }),
    setStatus: (status: MatchDayStatus, lockLineup?: boolean) =>
      push({ kind: 'status', status, lockLineup }),
  }
}

/** Ist dieser Satz abgeschlossen? Re-Export, damit Seiten nur einen Import brauchen. */
export { setFinished }

// ── Alle Ereignisse des aktuellen Teams (für Auswertungen) ──────────────────

/**
 * Protokollzeilen über alle Begegnungen des Teams. Der Inner-Join auf matchdays
 * filtert serverseitig aufs Team; RLS lässt ohnehin nur eigene Spieltage durch.
 */
export function useTeamEvents() {
  const { session } = useSession()
  const { currentTeamId } = useScope()

  const query = useQuery({
    queryKey: ['teamEvents', currentTeamId],
    enabled: isSupabaseConfigured && !!session && !!currentTeamId,
    staleTime: 60_000,
    queryFn: async (): Promise<MatchEvent[]> => {
      const { data, error } = await getSupabase()
        .from('matchday_events')
        .select('id,matchday_id,game_index,set_no,seq,kind,side,player_id,role,opponent_slot,matchdays!inner(team_id)')
        .eq('matchdays.team_id', currentTeamId as string)
      if (error) throw error
      return ((data ?? []) as EventRow[]).map(r => ({
        id: r.id, matchdayId: r.matchday_id, gameIndex: r.game_index, setNo: r.set_no as SetNo,
        seq: r.seq, kind: r.kind, side: r.side, playerId: r.player_id, role: r.role,
        opponentSlot: r.opponent_slot as OpponentSlot | null,
      }))
    },
  })

  return { events: query.data ?? [], isLoading: query.isLoading, error: query.error as Error | null }
}
