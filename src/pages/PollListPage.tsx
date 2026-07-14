import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import Header from '../components/Header'
import BottomNav from '../components/BottomNav'
import Can from '../components/Can'
import { useScope } from '../context/ScopeProvider'
import { getSupabase } from '../lib/supabase'

type PollRow = {
  id: string; title: string; status: 'open' | 'closed'; deadline: string | null
  created_at: string; poll_options: { id: string }[] | null
}

export default function PollListPage() {
  const navigate = useNavigate()
  const { currentTeamId } = useScope()
  const qc = useQueryClient()

  const { data: polls = [], isLoading } = useQuery({
    queryKey: ['polls', currentTeamId],
    enabled: !!currentTeamId,
    queryFn: async (): Promise<PollRow[]> => {
      const { data, error } = await getSupabase()
        .from('polls')
        .select('id,title,status,deadline,created_at,poll_options(id)')
        .eq('team_id', currentTeamId as string)
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as PollRow[]
    },
  })

  // Realtime: neue/veränderte Umfragen live nachladen
  useEffect(() => {
    if (!currentTeamId) return
    const sb = getSupabase()
    const ch = sb
      .channel(`polls-${currentTeamId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'polls', filter: `team_id=eq.${currentTeamId}` },
        () => qc.invalidateQueries({ queryKey: ['polls'] }))
      .subscribe()
    return () => { sb.removeChannel(ch) }
  }, [currentTeamId, qc])

  const fmt = (iso: string) => new Date(iso).toLocaleDateString('de-DE', { day: 'numeric', month: 'short' })

  return (
    <div className="min-h-screen bg-unicorn-purple pb-24">
      <div className="absolute w-[380px] h-[380px] rounded-full bg-unicorn-violet/35 blur-[130px] -top-20 right-0 pointer-events-none" />
      <Header
        title="Terminfindung"
        right={
          <Can cap="team:managePolls">
            <button
              onClick={() => navigate('/terminfindung/new')}
              className="w-9 h-9 rounded-full bg-unicorn-pink flex items-center justify-center text-white text-2xl font-bold shadow-lg shadow-unicorn-pink/40"
            >+</button>
          </Can>
        }
      />

      <div className="relative px-6 mt-2 space-y-3">
        {isLoading && <p className="text-white/50 text-sm text-center py-8">Lädt…</p>}
        {!isLoading && polls.length === 0 && (
          <div className="bg-[#2b0b4c] rounded-2xl p-6 text-center">
            <p className="text-4xl mb-3">📅</p>
            <p className="text-white font-semibold">Noch keine Umfrage</p>
            <p className="text-white/45 text-sm mt-1">Frag ab, wer wann kann – tippe auf +.</p>
          </div>
        )}
        {polls.map(p => (
          <button
            key={p.id}
            onClick={() => navigate(`/terminfindung/${p.id}`)}
            className="w-full bg-[#2b0b4c] rounded-2xl p-4 text-left"
          >
            <div className="flex items-center justify-between gap-2">
              <p className="text-white font-semibold text-[16px]">{p.title}</p>
              <span className={`text-xs font-semibold flex-shrink-0 ${p.status === 'open' ? 'text-unicorn-cyan' : 'text-white/40'}`}>
                {p.status === 'open' ? 'offen' : 'geschlossen'}
              </span>
            </div>
            <p className="text-white/50 text-sm mt-1">
              {p.poll_options?.length ?? 0} Termine{p.deadline ? ` · bis ${fmt(p.deadline)}` : ''}
            </p>
          </button>
        ))}
      </div>

      <BottomNav />
    </div>
  )
}
