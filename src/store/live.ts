import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getSupabase, isSupabaseConfigured } from '../lib/supabase'
import { useSession } from '../context/SessionProvider'
import { useScope } from '../context/ScopeProvider'
import type {
  EventKind, EventSide, GoalRole, MatchEvent, MatchSet, MatchDayStatus,
  OpponentName, OpponentSlot, SetNo,
} from '../types'
import { setFinished } from '../types'

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

function removeLastEvent(data: LiveData, gameIndex: number, setNo: SetNo): LiveData {
  const inSet = eventsOfSet(data, gameIndex, setNo)
  const last = inSet[inSet.length - 1]
  if (!last) return data
  return {
    ...data,
    events: data.events.filter(e => e.id !== last.id),
    sets: data.sets.map(s => (sameSet(s, last) && last.kind === 'goal'
      ? {
        ...s,
        goalsFor: Math.max(0, s.goalsFor - (last.side === 'us' ? 1 : 0)),
        goalsAgainst: Math.max(0, s.goalsAgainst - (last.side === 'them' ? 1 : 0)),
      }
      : s)),
  }
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

export function useMatchLive(matchdayId: string | undefined) {
  const qc = useQueryClient()
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
  const data = query.data ?? EMPTY

  const snapshot = async () => {
    await qc.cancelQueries({ queryKey: key })
    return qc.getQueryData<LiveData>(key) ?? EMPTY
  }
  const rollback = (ctx: { prev?: LiveData } | undefined) => {
    if (ctx?.prev) qc.setQueryData(key, ctx.prev)
  }
  const settle = () => {
    void qc.invalidateQueries({ queryKey: key })
    // Spieltagsliste und Aufstellung führen die Satzstände mit. refetchType
    // 'none' markiert sie nur als veraltet: kein Nachladen bei jedem Tipp,
    // aber frische Zahlen, sobald man dorthin zurückkehrt.
    void qc.invalidateQueries({ queryKey: ['matchDays'], refetchType: 'none' })
  }

  const recordMut = useMutation({
    // Wacklige Hallen-Verbindungen sind der Normalfall – lieber ein paar Mal
    // nachfassen, bevor ein Tor verloren geht.
    retry: 3,
    retryDelay: attempt => Math.min(1000 * 2 ** attempt, 8000),
    mutationFn: async (input: RecordEventInput) => {
      const { error } = await getSupabase().rpc('record_match_event', {
        p_matchday: matchdayId,
        p_game: input.gameIndex,
        p_set: input.setNo,
        p_kind: input.kind,
        p_side: input.side,
        p_player: input.playerId ?? null,
        p_role: input.role ?? null,
        p_opponent_slot: input.opponentSlot ?? null,
      })
      if (error) throw error
    },
    onMutate: async (input: RecordEventInput) => {
      const prev = await snapshot()
      const seq = Math.max(0, ...eventsOfSet(prev, input.gameIndex, input.setNo).map(e => e.seq)) + 1
      const optimistic: MatchEvent = {
        id: `pending-${input.gameIndex}-${input.setNo}-${seq}`,
        matchdayId: matchdayId as string,
        gameIndex: input.gameIndex, setNo: input.setNo, seq,
        kind: input.kind, side: input.side,
        playerId: input.playerId ?? null, role: input.role ?? null,
        opponentSlot: input.opponentSlot ?? null,
      }
      qc.setQueryData<LiveData>(key, applyEvent(prev, optimistic))
      return { prev }
    },
    onError: (_e, _v, ctx) => rollback(ctx),
    onSettled: settle,
  })

  const undoMut = useMutation({
    retry: 3,
    retryDelay: attempt => Math.min(1000 * 2 ** attempt, 8000),
    mutationFn: async (input: { gameIndex: number; setNo: SetNo }) => {
      const { error } = await getSupabase().rpc('undo_match_event', {
        p_matchday: matchdayId, p_game: input.gameIndex, p_set: input.setNo,
      })
      if (error) throw error
    },
    onMutate: async (input) => {
      const prev = await snapshot()
      qc.setQueryData<LiveData>(key, removeLastEvent(prev, input.gameIndex, input.setNo))
      return { prev }
    },
    onError: (_e, _v, ctx) => rollback(ctx),
    onSettled: settle,
  })

  const scoreMut = useMutation({
    retry: 2,
    mutationFn: async (input: MatchSet) => {
      const { error } = await getSupabase().from('matchday_sets').upsert({
        matchday_id: matchdayId,
        game_index: input.gameIndex,
        set_no: input.setNo,
        goals_for: input.goalsFor,
        goals_against: input.goalsAgainst,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'matchday_id,game_index,set_no' })
      if (error) throw error
    },
    onMutate: async (input: MatchSet) => {
      const prev = await snapshot()
      const sets = prev.sets.some(s => sameSet(s, input))
        ? prev.sets.map(s => (sameSet(s, input) ? input : s))
        : [...prev.sets, input]
      qc.setQueryData<LiveData>(key, { ...prev, sets })
      return { prev }
    },
    onError: (_e, _v, ctx) => rollback(ctx),
    onSettled: settle,
  })

  const opponentMut = useMutation({
    mutationFn: async (input: OpponentName) => {
      const sb = getSupabase()
      const name = input.name.trim()
      if (!name) {
        const { error } = await sb.from('matchday_opponents').delete()
          .eq('matchday_id', matchdayId).eq('game_index', input.gameIndex).eq('slot', input.slot)
        if (error) throw error
        return
      }
      const { error } = await sb.from('matchday_opponents').upsert({
        matchday_id: matchdayId, game_index: input.gameIndex, slot: input.slot, name,
      }, { onConflict: 'matchday_id,game_index,slot' })
      if (error) throw error
    },
    onMutate: async (input: OpponentName) => {
      const prev = await snapshot()
      const name = input.name.trim()
      const rest = prev.opponents.filter(o => !(o.gameIndex === input.gameIndex && o.slot === input.slot))
      qc.setQueryData<LiveData>(key, { ...prev, opponents: name ? [...rest, { ...input, name }] : rest })
      return { prev }
    },
    onError: (_e, _v, ctx) => rollback(ctx),
    onSettled: settle,
  })

  const statusMut = useMutation({
    mutationFn: async (input: { status: MatchDayStatus; lockLineup?: boolean }) => {
      const patch: Record<string, unknown> = { status: input.status }
      // „Läuft" heißt: die Aufstellung steht. Das Sperren gleich mitnehmen,
      // damit am Tisch niemand mehr aus Versehen einen Spieler verschiebt.
      if (input.lockLineup !== undefined) patch.lineup_locked = input.lockLineup
      const { error } = await getSupabase().from('matchdays').update(patch).eq('id', matchdayId)
      if (error) throw error
    },
    onSettled: () => { void qc.invalidateQueries({ queryKey: ['matchDays'] }) },
  })

  return {
    data,
    isLoading: query.isLoading,
    error: (query.error ?? recordMut.error ?? undoMut.error ?? scoreMut.error
      ?? opponentMut.error ?? statusMut.error) as Error | null,
    /** Ein Schreibvorgang ist unterwegs – für die „nicht gespeichert"-Anzeige. */
    pending: recordMut.isPending || undoMut.isPending || scoreMut.isPending,
    recordEvent: (input: RecordEventInput) => recordMut.mutate(input),
    undoLast: (gameIndex: number, setNo: SetNo) => undoMut.mutate({ gameIndex, setNo }),
    setScore: (input: MatchSet) => scoreMut.mutate(input),
    setOpponent: (input: OpponentName) => opponentMut.mutate(input),
    setStatus: (status: MatchDayStatus, lockLineup?: boolean) => statusMut.mutate({ status, lockLineup }),
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
