import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { Player, MatchDay, GameSlot, Position, GameTypePreference } from '../types'
import { getSupabase, isSupabaseConfigured } from '../lib/supabase'
import { useSession } from '../context/SessionProvider'
import { useScope } from '../context/ScopeProvider'

// ─── DB-Zeilen-Typen (snake_case) ───────────────────────────────────────────
type PlayerRow = { id: string; name: string; active: boolean; sort_order: number; user_id: string | null }
type PrefRow = {
  player_id: string; position: Position; game_type: GameTypePreference
  goalie_preference: boolean; avoids_opening: boolean; avoids_closing: boolean
}
type PartRow = { player_id: string; partner_player_id: string; weight: number }
type MdRow = {
  id: string; date: string; opponent: string | null
  start_time: string | null; location: string | null
  use_goalie: boolean; use_fifth_double: boolean; notes: string | null
  lineup: GameSlot[]
  matchday_players: { player_id: string; available_from: number; available_to: number }[] | null
}

// ─── Players ─────────────────────────────────────────────────────────────────

async function fetchPlayers(teamId: string): Promise<Player[]> {
  const sb = getSupabase()
  const [pl, pref, part] = await Promise.all([
    sb.from('players').select('id,name,active,sort_order,user_id').eq('team_id', teamId).order('sort_order', { ascending: true }),
    sb.from('player_preferences').select('*'),
    sb.from('partner_preferences').select('player_id,partner_player_id,weight'),
  ])
  if (pl.error) throw pl.error
  if (pref.error) throw pref.error
  if (part.error) throw part.error

  const prefBy = new Map<string, PrefRow>()
  for (const r of (pref.data ?? []) as PrefRow[]) prefBy.set(r.player_id, r)
  const partBy = new Map<string, PartRow[]>()
  for (const r of (part.data ?? []) as PartRow[]) {
    const list = partBy.get(r.player_id) ?? []
    list.push(r)
    partBy.set(r.player_id, list)
  }

  return ((pl.data ?? []) as PlayerRow[]).map(row => {
    const p = prefBy.get(row.id)
    return {
      id: row.id,
      name: row.name,
      active: row.active,
      userId: row.user_id,
      preferences: {
        position: p?.position ?? 'both',
        gameType: p?.game_type ?? 'both',
        goaliePreference: p?.goalie_preference ?? false,
        avoidsOpening: p?.avoids_opening ?? false,
        avoidsClosing: p?.avoids_closing ?? false,
        partnerPreferences: (partBy.get(row.id) ?? []).map(pp => ({
          playerId: pp.partner_player_id,
          weight: (pp.weight as 1 | 2 | 3),
        })),
      },
    }
  })
}

async function insertPlayer(p: Player, teamId: string, sortOrder: number) {
  const sb = getSupabase()
  const ins = await sb.from('players').insert({
    id: p.id, team_id: teamId, name: p.name, active: p.active, sort_order: sortOrder,
  })
  if (ins.error) throw ins.error
  await writePlayerPrefs(p)
}

async function writePlayerPrefs(p: Player) {
  const sb = getSupabase()
  const up = await sb.from('player_preferences').upsert({
    player_id: p.id,
    position: p.preferences.position,
    game_type: p.preferences.gameType,
    goalie_preference: p.preferences.goaliePreference,
    avoids_opening: p.preferences.avoidsOpening,
    avoids_closing: p.preferences.avoidsClosing,
  })
  if (up.error) throw up.error
  const del = await sb.from('partner_preferences').delete().eq('player_id', p.id)
  if (del.error) throw del.error
  const partners = p.preferences.partnerPreferences
  if (partners.length) {
    const ins = await sb.from('partner_preferences').insert(
      partners.map(pp => ({ player_id: p.id, partner_player_id: pp.playerId, weight: pp.weight })),
    )
    if (ins.error) throw ins.error
  }
}

export function usePlayers() {
  const qc = useQueryClient()
  const { session } = useSession()
  const { currentTeamId, isLoading: scopeLoading } = useScope()
  const enabled = isSupabaseConfigured && !!session && !!currentTeamId
  const playersKey = ['players', currentTeamId] as const

  const query = useQuery({ queryKey: playersKey, enabled, queryFn: () => fetchPlayers(currentTeamId as string) })
  const players = query.data ?? []
  const invalidate = () => qc.invalidateQueries({ queryKey: ['players'] })

  const addMut = useMutation({
    mutationFn: async (p: Player) => {
      if (!currentTeamId) throw new Error('Kein Team ausgewählt')
      await insertPlayer(p, currentTeamId, players.length)
    },
    onSuccess: invalidate,
  })
  const updateMut = useMutation({
    mutationFn: async (p: Player) => {
      const sb = getSupabase()
      const upd = await sb.from('players').update({ name: p.name, active: p.active }).eq('id', p.id)
      if (upd.error) throw upd.error
      await writePlayerPrefs(p)
    },
    onSuccess: invalidate,
  })
  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      const sb = getSupabase()
      const del = await sb.from('players').delete().eq('id', id)
      if (del.error) throw del.error
    },
    onSuccess: invalidate,
  })
  const reorderMut = useMutation({
    mutationFn: async (list: Player[]) => {
      const sb = getSupabase()
      await Promise.all(list.map((p, i) =>
        sb.from('players').update({ sort_order: i }).eq('id', p.id).then(({ error }) => { if (error) throw error }),
      ))
    },
    onMutate: async (list: Player[]) => {
      await qc.cancelQueries({ queryKey: playersKey })
      const prev = qc.getQueryData<Player[]>(playersKey)
      qc.setQueryData<Player[]>(playersKey, list)
      return { prev }
    },
    onError: (_e, _v, ctx: { prev?: Player[] } | undefined) => {
      if (ctx?.prev) qc.setQueryData(playersKey, ctx.prev)
    },
    onSettled: () => { void invalidate() },
  })
  const replaceMut = useMutation({
    mutationFn: async (list: Player[]) => {
      if (!currentTeamId) throw new Error('Kein Team ausgewählt')
      const sb = getSupabase()
      const del = await sb.from('players').delete().eq('team_id', currentTeamId)
      if (del.error) throw del.error
      for (let i = 0; i < list.length; i++) await insertPlayer(list[i], currentTeamId, i)
    },
    onSuccess: invalidate,
  })

  return {
    players,
    isLoading: scopeLoading || query.isLoading,
    error: query.error as Error | null,
    addPlayer: (p: Player) => addMut.mutate(p),
    updatePlayer: (p: Player) => updateMut.mutate(p),
    deletePlayer: (id: string) => deleteMut.mutate(id),
    replaceAll: (list: Player[]) => replaceMut.mutate(list),
    reorder: (list: Player[]) => reorderMut.mutate(list),
  }
}

// ─── MatchDays ───────────────────────────────────────────────────────────────

async function fetchMatchDays(teamId: string): Promise<MatchDay[]> {
  const sb = getSupabase()
  const { data, error } = await sb
    .from('matchdays')
    .select('id,date,start_time,location,opponent,use_goalie,use_fifth_double,notes,lineup,matchday_players(player_id,available_from,available_to)')
    .eq('team_id', teamId)
    .order('date', { ascending: true })
  if (error) throw error
  return ((data ?? []) as MdRow[]).map(m => ({
    id: m.id,
    date: m.date,
    startTime: m.start_time ? m.start_time.slice(0, 5) : null,
    location: m.location ?? null,
    opponent: m.opponent ?? undefined,
    useGoalie: m.use_goalie,
    useFifthDouble: m.use_fifth_double,
    notes: m.notes ?? undefined,
    players: (m.matchday_players ?? []).map(mp => ({
      playerId: mp.player_id,
      availableFrom: mp.available_from,
      availableTo: mp.available_to,
    })),
    lineup: m.lineup ?? [],
  }))
}

async function writeMatchDayAvailability(md: MatchDay) {
  const sb = getSupabase()
  const del = await sb.from('matchday_players').delete().eq('matchday_id', md.id)
  if (del.error) throw del.error
  if (md.players.length) {
    const ins = await sb.from('matchday_players').insert(
      md.players.map(p => ({
        matchday_id: md.id, player_id: p.playerId,
        available_from: p.availableFrom, available_to: p.availableTo,
      })),
    )
    if (ins.error) throw ins.error
  }
}

export function useMatchDays() {
  const qc = useQueryClient()
  const { session } = useSession()
  const { currentTeamId, isLoading: scopeLoading } = useScope()
  const enabled = isSupabaseConfigured && !!session && !!currentTeamId
  const mdKey = ['matchDays', currentTeamId] as const

  const query = useQuery({ queryKey: mdKey, enabled, queryFn: () => fetchMatchDays(currentTeamId as string) })
  const matchDays = query.data ?? []
  const invalidate = () => qc.invalidateQueries({ queryKey: ['matchDays'] })

  const addMut = useMutation({
    mutationFn: async (md: MatchDay) => {
      if (!currentTeamId) throw new Error('Kein Team ausgewählt')
      const sb = getSupabase()
      const ins = await sb.from('matchdays').insert({
        id: md.id, team_id: currentTeamId, date: md.date, opponent: md.opponent ?? null,
        start_time: md.startTime || null, location: md.location || null,
        use_goalie: md.useGoalie, use_fifth_double: md.useFifthDouble,
        notes: md.notes ?? null, lineup: md.lineup,
      })
      if (ins.error) throw ins.error
      await writeMatchDayAvailability(md)
    },
    onSuccess: invalidate,
  })
  const updateMut = useMutation({
    mutationFn: async (md: MatchDay) => {
      const sb = getSupabase()
      const upd = await sb.from('matchdays').update({
        date: md.date, opponent: md.opponent ?? null,
        start_time: md.startTime || null, location: md.location || null,
        use_goalie: md.useGoalie, use_fifth_double: md.useFifthDouble,
        notes: md.notes ?? null, lineup: md.lineup,
      }).eq('id', md.id)
      if (upd.error) throw upd.error
      await writeMatchDayAvailability(md)
    },
    onSuccess: invalidate,
  })
  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      const sb = getSupabase()
      const del = await sb.from('matchdays').delete().eq('id', id)
      if (del.error) throw del.error
    },
    onSuccess: invalidate,
  })
  const replaceMut = useMutation({
    mutationFn: async (list: MatchDay[]) => {
      if (!currentTeamId) throw new Error('Kein Team ausgewählt')
      const sb = getSupabase()
      const del = await sb.from('matchdays').delete().eq('team_id', currentTeamId)
      if (del.error) throw del.error
      for (const md of list) {
        const ins = await sb.from('matchdays').insert({
          id: md.id, team_id: currentTeamId, date: md.date, opponent: md.opponent ?? null,
          start_time: md.startTime || null, location: md.location || null,
          use_goalie: md.useGoalie, use_fifth_double: md.useFifthDouble,
          notes: md.notes ?? null, lineup: md.lineup,
        })
        if (ins.error) throw ins.error
        await writeMatchDayAvailability(md)
      }
    },
    onSuccess: invalidate,
  })

  return {
    matchDays,
    isLoading: scopeLoading || query.isLoading,
    error: query.error as Error | null,
    addMatchDay: (md: MatchDay) => addMut.mutate(md),
    updateMatchDay: (md: MatchDay) => updateMut.mutate(md),
    deleteMatchDay: (id: string) => deleteMut.mutate(id),
    replaceAll: (list: MatchDay[]) => replaceMut.mutate(list),
  }
}
