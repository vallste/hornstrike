import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import Header from '../components/Header'
import { useSession } from '../context/SessionProvider'
import { useScope } from '../context/ScopeProvider'
import { getSupabase } from '../lib/supabase'

type ClubRow = { id: string; name: string; teams: { id: string; name: string }[] | null }
type MembershipRow = { club_id: string | null; role: string; user_id: string }

export default function ManagePage() {
  const { user } = useSession()
  const { currentTeamId, setCurrentTeam } = useScope()
  const qc = useQueryClient()
  const navigate = useNavigate()

  const [newTeam, setNewTeam] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [renaming, setRenaming] = useState<string | null>(null)
  const [renameVal, setRenameVal] = useState('')
  const [renamingClub, setRenamingClub] = useState<string | null>(null)
  const [clubVal, setClubVal] = useState('')

  const { data: clubs = [], isLoading } = useQuery({
    queryKey: ['manage', 'clubs'],
    queryFn: async (): Promise<ClubRow[]> => {
      const { data, error } = await getSupabase().from('clubs').select('id,name,teams(id,name)').order('name')
      if (error) throw error
      return (data ?? []) as ClubRow[]
    },
  })

  const { data: perms } = useQuery({
    queryKey: ['manage', 'perms', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const sb = getSupabase()
      const [prof, mems] = await Promise.all([
        sb.from('profiles').select('is_platform_admin').maybeSingle(),
        sb.from('memberships').select('club_id,role,user_id'),
      ])
      const isPlatform = !!(prof.data as { is_platform_admin?: boolean } | null)?.is_platform_admin
      const clubAdmin = new Set(
        ((mems.data ?? []) as MembershipRow[])
          .filter(m => m.role === 'club_admin' && m.user_id === user?.id && m.club_id)
          .map(m => m.club_id as string),
      )
      return { isPlatform, clubAdmin }
    },
  })
  const canManage = (clubId: string) => !!perms && (perms.isPlatform || perms.clubAdmin.has(clubId))

  const createTeam = async (clubId: string) => {
    const name = (newTeam[clubId] ?? '').trim()
    if (!name || busy) return
    setBusy(clubId); setError(null)
    const { error } = await getSupabase().from('teams').insert({ club_id: clubId, name })
    setBusy(null)
    if (error) { setError(error.message); return }
    setNewTeam(s => ({ ...s, [clubId]: '' }))
    qc.invalidateQueries({ queryKey: ['manage'] })
    qc.invalidateQueries({ queryKey: ['workspaces'] })
  }

  const doRename = async (teamId: string) => {
    const name = renameVal.trim()
    if (!name) return
    const { error } = await getSupabase().from('teams').update({ name }).eq('id', teamId)
    if (error) { setError(error.message); return }
    setRenaming(null)
    qc.invalidateQueries({ queryKey: ['manage'] })
    qc.invalidateQueries({ queryKey: ['workspaces'] })
  }

  const doRenameClub = async (clubId: string) => {
    const name = clubVal.trim()
    if (!name) return
    const { error } = await getSupabase().from('clubs').update({ name }).eq('id', clubId)
    if (error) { setError(error.message); return }
    setRenamingClub(null)
    qc.invalidateQueries({ queryKey: ['manage'] })
    qc.invalidateQueries({ queryKey: ['workspaces'] })
  }

  const switchTo = (teamId: string) => { setCurrentTeam(teamId); navigate('/home') }

  return (
    <div className="min-h-screen bg-unicorn-purple pb-24">
      <div className="absolute w-[360px] h-[360px] rounded-full bg-unicorn-violet/35 blur-[140px] -top-20 right-0 pointer-events-none" />
      <Header title="Vereine & Teams" back />

      <div className="relative px-6 mt-4 space-y-3">
        {isLoading && <p className="text-white/50 text-sm text-center py-8">Lädt…</p>}
        {clubs.map(club => (
          <div key={club.id} className="bg-[#2b0b4c] rounded-2xl overflow-hidden">
            <div className="px-4 py-3 border-b border-white/5 flex items-center gap-2">
              {renamingClub === club.id ? (
                <>
                  <input
                    value={clubVal} onChange={e => setClubVal(e.target.value)} autoFocus
                    onKeyDown={e => e.key === 'Enter' && doRenameClub(club.id)}
                    className="flex-1 bg-[#391060] rounded-lg px-2.5 py-1.5 text-white text-sm outline-none"
                  />
                  <button onClick={() => doRenameClub(club.id)} className="text-unicorn-cyan text-sm font-semibold">Speichern</button>
                  <button onClick={() => setRenamingClub(null)} className="text-white/40 text-lg px-1">✕</button>
                </>
              ) : (
                <>
                  <p className="text-white font-bold text-[16px] flex-1 truncate">{club.name}</p>
                  {canManage(club.id) && (
                    <button onClick={() => { setRenamingClub(club.id); setClubVal(club.name) }} className="text-white/30 text-sm px-1 flex-shrink-0">✎</button>
                  )}
                </>
              )}
            </div>
            {(club.teams ?? []).map(t => (
              <div key={t.id} className="flex items-center gap-2 px-4 py-3 border-b border-white/5">
                {renaming === t.id ? (
                  <>
                    <input
                      value={renameVal} onChange={e => setRenameVal(e.target.value)} autoFocus
                      onKeyDown={e => e.key === 'Enter' && doRename(t.id)}
                      className="flex-1 bg-[#391060] rounded-lg px-2.5 py-1.5 text-white text-sm outline-none"
                    />
                    <button onClick={() => doRename(t.id)} className="text-unicorn-cyan text-sm font-semibold">Speichern</button>
                    <button onClick={() => setRenaming(null)} className="text-white/40 text-lg px-1">✕</button>
                  </>
                ) : (
                  <>
                    <button onClick={() => switchTo(t.id)} className="flex-1 flex items-center justify-between text-left min-w-0">
                      <span className="text-white text-[15px] truncate">{t.name}</span>
                      {t.id === currentTeamId
                        ? <span className="text-unicorn-cyan text-xs font-semibold flex-shrink-0">aktiv</span>
                        : <span className="text-white/30 text-lg flex-shrink-0">›</span>}
                    </button>
                    {canManage(club.id) && (
                      <button onClick={() => { setRenaming(t.id); setRenameVal(t.name) }} className="text-white/30 text-sm px-1 flex-shrink-0">✎</button>
                    )}
                  </>
                )}
              </div>
            ))}
            {(club.teams ?? []).length === 0 && (
              <p className="px-4 py-3 text-white/40 text-sm border-b border-white/5">Noch kein Team</p>
            )}
            {canManage(club.id) && (
              <div className="px-4 py-3 flex gap-2">
                <input
                  value={newTeam[club.id] ?? ''}
                  onChange={e => setNewTeam(s => ({ ...s, [club.id]: e.target.value }))}
                  placeholder="Neues Team…"
                  className="flex-1 bg-[#391060] rounded-xl px-3 py-2 text-white text-sm placeholder-white/30 outline-none"
                />
                <button
                  onClick={() => createTeam(club.id)}
                  disabled={busy === club.id || !(newTeam[club.id] ?? '').trim()}
                  className="px-4 rounded-xl bg-unicorn-pink text-white text-lg font-bold disabled:opacity-40"
                >+</button>
              </div>
            )}
          </div>
        ))}
        {error && <p className="text-red-400 text-sm text-center">{error}</p>}
      </div>
    </div>
  )
}
