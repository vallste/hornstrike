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

  const list = requests ?? []

  return (
    <div className="min-h-screen bg-unicorn-purple pb-24">
      <div className="absolute w-[360px] h-[360px] rounded-full bg-unicorn-violet/35 blur-[140px] -top-20 right-0 pointer-events-none" />
      <Header title="Vereins-Anträge" back />

      <div className="relative px-6 mt-4 space-y-3">
        {isLoading ? (
          <p className="text-white/50 text-sm text-center py-8">Lädt…</p>
        ) : list.length === 0 ? (
          <div className="bg-[#2b0b4c] rounded-2xl p-6 text-center">
            <p className="text-3xl mb-2">📭</p>
            <p className="text-white font-semibold">Keine offenen Anträge</p>
          </div>
        ) : (
          list.map(r => (
            <div key={r.id} className="bg-[#2b0b4c] rounded-2xl px-4 py-3.5">
              <p className="text-white font-semibold text-[16px]">{r.club_name}</p>
              {r.note && <p className="text-white/55 text-sm mt-1">{r.note}</p>}
              <p className="text-white/30 text-xs mt-1">{new Date(r.created_at).toLocaleString('de-DE')}</p>
              <button
                onClick={() => approve(r.id)} disabled={busyId === r.id}
                className="mt-3 w-full py-2.5 rounded-xl bg-unicorn-cyan text-[#1a0533] text-sm font-bold disabled:opacity-50"
              >
                {busyId === r.id ? 'Wird freigegeben…' : 'Freigeben → Verein anlegen'}
              </button>
            </div>
          ))
        )}
        {error && <p className="text-red-400 text-sm text-center">{error}</p>}
      </div>
    </div>
  )
}
