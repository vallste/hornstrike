import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import Header from '../components/Header'
import { useSession } from '../context/SessionProvider'
import { useTeamStatus } from '../lib/permissions'
import { getSupabase } from '../lib/supabase'

type RequestRow = { id: string; club_name: string; status: 'pending' | 'approved' | 'rejected'; created_at: string }

export default function RequestClubPage() {
  const { user, signOut } = useSession()
  const teamStatus = useTeamStatus()
  const qc = useQueryClient()
  const navigate = useNavigate()

  const [name, setName] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const { data: myRequests } = useQuery({
    queryKey: ['clubRequests', 'mine'],
    queryFn: async (): Promise<RequestRow[]> => {
      const { data, error } = await getSupabase()
        .from('club_requests')
        .select('id,club_name,status,created_at')
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as RequestRow[]
    },
  })
  const pending = (myRequests ?? []).find(r => r.status === 'pending')

  const submit = async () => {
    if (!name.trim() || busy || !user) return
    setBusy(true); setError(null)
    const { error } = await getSupabase()
      .from('club_requests')
      .insert({ requested_by: user.id, club_name: name.trim(), note: note.trim() || null })
    setBusy(false)
    if (error) { setError(error.message); return }
    setName(''); setNote('')
    qc.invalidateQueries({ queryKey: ['clubRequests'] })
  }

  return (
    <div className="min-h-screen bg-app pb-24">
      <div className="absolute w-[360px] h-[360px] rounded-full bg-unicorn-violet/35 blur-[140px] -top-20 right-0 pointer-events-none" />
      <Header title="Verein beantragen" back={teamStatus === 'has' ? true : undefined} />

      <div className="relative px-6 mt-4 space-y-3">
        {pending ? (
          <div className="bg-surface rounded-2xl px-4 py-5 text-center">
            <p className="text-3xl mb-2">⏳</p>
            <p className="text-fg font-semibold text-[15px]">Antrag läuft</p>
            <p className="text-fg/55 text-sm mt-1">
              „{pending.club_name}" wartet auf Freigabe durch einen Plattform-Admin.
            </p>
          </div>
        ) : (
          <>
            <div className="bg-surface rounded-2xl px-4 py-3.5">
              <p className="text-fg/45 text-[12px] font-semibold tracking-widest uppercase mb-2">Vereinsname</p>
              <input
                type="text" value={name} onChange={e => setName(e.target.value)} autoFocus
                placeholder="z. B. TSV Musterstadt"
                className="w-full bg-transparent text-fg placeholder-fg/25 text-[17px] font-semibold outline-none"
              />
            </div>
            <div className="bg-surface rounded-2xl px-4 py-3.5">
              <p className="text-fg/45 text-[12px] font-semibold tracking-widest uppercase mb-2">Notiz (optional)</p>
              <textarea
                value={note} onChange={e => setNote(e.target.value)} rows={3}
                placeholder="Kurz zu dir / deinem Verein"
                className="w-full bg-transparent text-fg placeholder-fg/25 text-[15px] outline-none resize-none"
              />
            </div>
            <button
              onClick={submit} disabled={busy || !name.trim()}
              className="w-full py-3.5 rounded-2xl font-semibold text-white bg-gradient-to-r from-unicorn-violet to-unicorn-pink disabled:opacity-40"
            >
              {busy ? 'Senden…' : 'Antrag stellen'}
            </button>
            {error && <p className="text-red-400 text-sm text-center">{error}</p>}
            <p className="text-fg/40 text-xs text-center px-2">
              Nach der Freigabe wirst du Vereins-Admin und kannst Teams anlegen und Spieler einladen.
            </p>
          </>
        )}

        {teamStatus !== 'has' && (
          <div className="bg-surface/60 rounded-2xl px-4 py-4 mt-2">
            <p className="text-fg/55 text-sm">
              Du wurdest zu einem Team eingeladen? Öffne einfach den <span className="text-fg">Einladungslink</span> deines Captains.
            </p>
            <button
              onClick={async () => { await signOut(); navigate('/login', { replace: true }) }}
              className="text-accent-pink text-sm font-semibold mt-3"
            >Abmelden</button>
          </div>
        )}
      </div>
    </div>
  )
}
