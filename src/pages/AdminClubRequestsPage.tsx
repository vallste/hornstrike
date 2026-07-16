import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import Header from '../components/Header'
import { getSupabase } from '../lib/supabase'

type RequestRow = { id: string; club_name: string; note: string | null; created_at: string }

export default function AdminClubRequestsPage() {
  const qc = useQueryClient()
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const { data: requests, isLoading } = useQuery({
    queryKey: ['clubRequests', 'pending'],
    queryFn: async (): Promise<RequestRow[]> => {
      const { data, error } = await getSupabase()
        .from('club_requests')
        .select('id,club_name,note,created_at')
        .eq('status', 'pending')
        .order('created_at', { ascending: true })
      if (error) throw error
      return (data ?? []) as RequestRow[]
    },
  })

  const approve = async (id: string) => {
    setBusyId(id); setError(null)
    const { error } = await getSupabase().rpc('approve_club_request', { p_request: id })
    setBusyId(null)
    if (error) { setError(error.message); return }
    qc.invalidateQueries()
  }

  const reject = async (id: string) => {
    setBusyId(id); setError(null)
    const { error } = await getSupabase().rpc('reject_club_request', { p_request: id })
    setBusyId(null)
    if (error) { setError(error.message); return }
    qc.invalidateQueries({ queryKey: ['clubRequests'] })
  }

  const list = requests ?? []

  return (
    <div className="min-h-screen bg-app pb-24">
      <div className="absolute w-[360px] h-[360px] rounded-full bg-unicorn-violet/35 blur-[140px] -top-20 right-0 pointer-events-none" />
      <Header title="Vereins-Anträge" back />

      <div className="relative px-6 mt-4 space-y-3">
        {isLoading ? (
          <p className="text-fg/50 text-sm text-center py-8">Lädt…</p>
        ) : list.length === 0 ? (
          <div className="bg-surface rounded-2xl p-6 text-center">
            <p className="text-3xl mb-2">📭</p>
            <p className="text-fg font-semibold">Keine offenen Anträge</p>
          </div>
        ) : (
          list.map(r => (
            <div key={r.id} className="bg-surface rounded-2xl px-4 py-3.5">
              <p className="text-fg font-semibold text-[16px]">{r.club_name}</p>
              {r.note && <p className="text-fg/55 text-sm mt-1">{r.note}</p>}
              <p className="text-fg/30 text-xs mt-1">{new Date(r.created_at).toLocaleString('de-DE')}</p>
              <div className="mt-3 flex gap-2">
                <button
                  onClick={() => reject(r.id)} disabled={busyId === r.id}
                  className="px-4 py-2.5 rounded-xl bg-surface2 text-fg/60 text-sm font-semibold disabled:opacity-50"
                >Ablehnen</button>
                <button
                  onClick={() => approve(r.id)} disabled={busyId === r.id}
                  className="flex-1 py-2.5 rounded-xl bg-unicorn-cyan text-[#1a0533] text-sm font-bold disabled:opacity-50"
                >
                  {busyId === r.id ? 'Moment…' : 'Freigeben → Verein anlegen'}
                </button>
              </div>
            </div>
          ))
        )}
        {error && <p className="text-red-400 text-sm text-center">{error}</p>}
      </div>
    </div>
  )
}
