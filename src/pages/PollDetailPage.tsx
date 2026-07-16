import { useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import Header from '../components/Header'
import LoadingScreen from '../components/LoadingScreen'
import { usePlayers } from '../store'
import { useCan, useMyPlayerId } from '../lib/permissions'
import { getSupabase } from '../lib/supabase'
import { useTrack } from '../lib/analytics'

type Poll = { id: string; title: string; status: 'open' | 'closed'; deadline: string | null; default_time: string | null; default_location: string | null; default_opponent: string | null }
type Option = { id: string; proposed_date: string; label: string | null; sort_order: number; start_time: string | null; location: string | null }
type Resp = { id: string; poll_option_id: string; player_id: string; status: 'available' | 'maybe' | 'no' }

const STATUS_LABEL = { available: '✅ Kann', maybe: '❓ Vielleicht', no: '❌ Nein' } as const
const STATUS_ACTIVE = {
  available: 'bg-emerald-600 text-white',
  maybe: 'bg-unicorn-gold text-[#1a0533]',
  no: 'bg-red-600 text-white',
} as const

export default function PollDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { players } = usePlayers()
  const canManage = useCan('team:managePolls')
  const myPlayerId = useMyPlayerId()
  const track = useTrack()

  const { data, isLoading, error } = useQuery({
    queryKey: ['poll', id],
    enabled: !!id,
    queryFn: async () => {
      const sb = getSupabase()
      const { data: poll, error: e1 } = await sb.from('polls').select('id,title,status,deadline,default_time,default_location,default_opponent').eq('id', id as string).single()
      if (e1) throw e1
      const { data: options, error: e2 } = await sb.from('poll_options').select('id,proposed_date,label,sort_order,start_time,location').eq('poll_id', id as string).order('sort_order', { ascending: true })
      if (e2) throw e2
      const optIds = ((options ?? []) as Option[]).map(o => o.id)
      let responses: Resp[] = []
      if (optIds.length) {
        const { data: r, error: e3 } = await sb.from('poll_responses').select('id,poll_option_id,player_id,status').in('poll_option_id', optIds)
        if (e3) throw e3
        responses = (r ?? []) as Resp[]
      }
      return { poll: poll as Poll, options: (options ?? []) as Option[], responses }
    },
  })

  useEffect(() => {
    if (!id) return
    const sb = getSupabase()
    const ch = sb
      .channel(`poll-${id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'poll_responses' },
        () => qc.invalidateQueries({ queryKey: ['poll', id] }))
      .subscribe()
    return () => { sb.removeChannel(ch) }
  }, [id, qc])

  if (isLoading) return <LoadingScreen />
  if (error || !data) {
    return (
      <div className="min-h-screen bg-app flex items-center justify-center px-6">
        <div className="text-center">
          <p className="text-fg text-lg font-semibold">Umfrage konnte nicht geladen werden</p>
          {error && <p className="text-red-300/80 text-sm mt-2 break-words">{(error as Error).message}</p>}
          <button onClick={() => navigate('/terminfindung')} className="text-accent-pink mt-4 block mx-auto">← Zurück</button>
        </div>
      </div>
    )
  }
  const { poll, options, responses } = data
  const open = poll.status === 'open'
  const myResp = (optId: string) => responses.find(r => r.poll_option_id === optId && r.player_id === myPlayerId)?.status
  const fmt = (d: string) => new Date(d + 'T12:00:00').toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric', month: 'long' })
  const fmtShort = (d: string) => new Date(d + 'T12:00:00').toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric', month: 'numeric' })
  const countAvail = (optId: string) => responses.filter(r => r.poll_option_id === optId && r.status === 'available').length
  const countAvailMaybe = (optId: string) => responses.filter(r => r.poll_option_id === optId && (r.status === 'available' || r.status === 'maybe')).length
  const cell = (st?: string) => (st === 'available' ? '✅' : st === 'maybe' ? '❓' : st === 'no' ? '❌' : '·')
  const optTime = (o: Option) => (o.start_time ?? poll.default_time)?.slice(0, 5) ?? ''
  const optLoc = (o: Option) => o.location ?? poll.default_location ?? ''

  const respond = async (optId: string, status: Resp['status']) => {
    if (!myPlayerId) return
    await getSupabase().from('poll_responses').upsert(
      { poll_option_id: optId, player_id: myPlayerId, status },
      { onConflict: 'poll_option_id,player_id' },
    )
    track('poll_responded', { status })
    qc.invalidateQueries({ queryKey: ['poll', id] })
  }
  const toggleClosed = async () => {
    await getSupabase().from('polls').update({ status: open ? 'closed' : 'open' }).eq('id', poll.id)
    qc.invalidateQueries({ queryKey: ['poll', id] })
    qc.invalidateQueries({ queryKey: ['polls'] })
  }
  const createLineup = (opt: Option) => {
    const availIds = responses.filter(r => r.poll_option_id === opt.id && r.status === 'available').map(r => r.player_id)
    const time = (opt.start_time ?? poll.default_time)?.slice(0, 5) || undefined
    const loc = opt.location ?? poll.default_location ?? undefined
    navigate('/matchday/new', { state: { date: opt.proposed_date, playerIds: availIds, time, location: loc, opponent: poll.default_opponent ?? undefined } })
  }

  return (
    <div className="min-h-screen bg-app pb-24">
      <div className="absolute w-[360px] h-[360px] rounded-full bg-unicorn-violet/35 blur-[140px] -top-20 right-0 pointer-events-none" />
      <Header title={`${poll.title}${poll.default_opponent ? ` – ${poll.default_opponent}` : ''}`} back />

      <div className="relative px-6 mt-2 space-y-3">
        <p className="text-fg/50 text-sm">
          {open ? 'Offen' : 'Geschlossen'}
          {poll.deadline ? ` · Deadline ${new Date(poll.deadline).toLocaleDateString('de-DE')}` : ''}
        </p>
        {(poll.default_time || poll.default_location) && (
          <p className="text-fg/60 text-sm">
            {[poll.default_time ? `🕐 ${poll.default_time.slice(0, 5)} Uhr` : '', poll.default_location ? `📍 ${poll.default_location}` : ''].filter(Boolean).join('  ·  ')}
          </p>
        )}

        {myPlayerId && (
          <div className="bg-surface rounded-2xl overflow-hidden">
            <div className="px-4 py-3 border-b border-fg/5">
              <p className="text-fg/45 text-[12px] font-semibold tracking-widest uppercase">Deine Verfügbarkeit</p>
            </div>
            {options.map(o => (
              <div key={o.id} className="px-4 py-3 border-b border-fg/5">
                <p className="text-fg text-sm">{fmt(o.proposed_date)}</p>
                {(optTime(o) || optLoc(o)) && (
                  <p className="text-fg/45 text-xs">{[optTime(o) && `${optTime(o)} Uhr`, optLoc(o)].filter(Boolean).join(' · ')}</p>
                )}
                <div className="flex gap-2 mt-2">
                  {(['available', 'maybe', 'no'] as const).map(s => (
                    <button
                      key={s} disabled={!open} onClick={() => respond(o.id, s)}
                      className={`flex-1 py-2 rounded-xl text-sm font-semibold transition-colors disabled:opacity-50 ${myResp(o.id) === s ? STATUS_ACTIVE[s] : 'bg-surface2 text-fg/50'}`}
                    >{STATUS_LABEL[s]}</button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {canManage && (
          <div className="bg-surface rounded-2xl p-4">
            <p className="text-fg/45 text-[12px] font-semibold tracking-widest uppercase mb-3">Ergebnisse</p>

            <div className="overflow-x-auto -mx-1">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr>
                    <th className="text-left px-1.5 py-1.5 font-medium text-fg/40"> </th>
                    {options.map(o => {
                      const t = (o.start_time ?? poll.default_time)?.slice(0, 5)
                      return (
                        <th key={o.id} className="px-1.5 py-1.5 font-medium text-fg/70 text-center whitespace-nowrap align-bottom">
                          <div>{fmtShort(o.proposed_date)}</div>
                          {t && <div className="text-fg/40 text-[11px] font-normal">{t}</div>}
                          {o.location && <div className="text-accent-gold/80 text-[11px] font-normal max-w-[90px] truncate mx-auto" title={o.location}>📍{o.location}</div>}
                        </th>
                      )
                    })}
                  </tr>
                </thead>
                <tbody>
                  {players.filter(p => p.active !== false).map(p => (
                    <tr key={p.id} className="border-t border-fg/5">
                      <td className="px-1.5 py-1.5 text-fg/85 whitespace-nowrap">{p.name}</td>
                      {options.map(o => {
                        const st = responses.find(r => r.player_id === p.id && r.poll_option_id === o.id)?.status
                        return (
                          <td key={o.id} className="px-1.5 py-1.5 text-center">
                            {st ? cell(st) : <span className="text-fg/20">·</span>}
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-fg/15">
                    <td className="px-1.5 py-1.5 text-emerald-400 font-semibold whitespace-nowrap">Kann</td>
                    {options.map(o => <td key={o.id} className="px-1.5 py-1.5 text-center text-emerald-400 font-bold">{countAvail(o.id)}</td>)}
                  </tr>
                  <tr>
                    <td className="px-1.5 py-1.5 text-accent-gold font-semibold whitespace-nowrap">+ Vielleicht</td>
                    {options.map(o => <td key={o.id} className="px-1.5 py-1.5 text-center text-accent-gold font-bold">{countAvailMaybe(o.id)}</td>)}
                  </tr>
                  <tr>
                    <td className="px-1.5 pt-2"> </td>
                    {options.map(o => (
                      <td key={o.id} className="px-1.5 pt-2 text-center">
                        <button onClick={() => createLineup(o)} className="text-accent-pink text-xs font-semibold whitespace-nowrap">→ Aufstellung</button>
                      </td>
                    ))}
                  </tr>
                </tfoot>
              </table>
            </div>

            <button onClick={toggleClosed} className="mt-3 text-fg/55 text-sm">
              {open ? 'Umfrage schließen' : 'Umfrage wieder öffnen'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
