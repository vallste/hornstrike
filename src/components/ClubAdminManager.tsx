import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { getSupabase } from '../lib/supabase'
import { errorMessage } from '../lib/errors'
import { ROLE_LABEL, type Role } from '../lib/permissions'

type TeamRole = { team_id: string; team_name: string | null; role: Role }
type ClubMember = {
  user_id: string
  display_name: string | null
  email: string | null
  is_club_admin: boolean
  team_roles: TeamRole[]
}

/**
 * Vereins-Admins eines Vereins verwalten (Plattform-Admin & bestehende
 * Vereins-Admins). Lädt die Mitgliederliste erst beim Aufklappen (eine RPC pro
 * Verein). Der letzte Vereins-Admin ist serverseitig geschützt.
 */
export default function ClubAdminManager({ clubId }: { clubId: string }) {
  const qc = useQueryClient()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const { data: members = [], isLoading } = useQuery({
    queryKey: ['clubMembers', clubId],
    enabled: open,
    queryFn: async (): Promise<ClubMember[]> => {
      const { data, error } = await getSupabase().rpc('club_members', { p_club: clubId })
      if (error) throw error
      return (data ?? []) as ClubMember[]
    },
  })

  const setClubAdmin = async (userId: string, make: boolean) => {
    setBusy(userId); setError(null)
    const { error } = await getSupabase().rpc('set_club_admin', { p_user: userId, p_club: clubId, p_make: make })
    setBusy(null)
    if (error) { setError(errorMessage(error)); return }
    qc.invalidateQueries({ queryKey: ['clubMembers', clubId] })
    qc.invalidateQueries({ queryKey: ['manage'] })
    qc.invalidateQueries({ queryKey: ['workspaces'] })
    qc.invalidateQueries({ queryKey: ['scopeAccess'] })
    qc.invalidateQueries({ queryKey: ['role'] })
  }

  const label = (m: ClubMember) => m.display_name || m.email || 'Unbekannt'
  const teamHint = (m: ClubMember) =>
    m.team_roles.map(tr => `${tr.team_name ?? 'Team'}: ${ROLE_LABEL[tr.role] ?? tr.role}`).join(' · ')

  return (
    <div className="px-4 py-3 border-b border-fg/5">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between text-left"
      >
        <span className="text-fg/45 text-[12px] font-semibold tracking-widest uppercase">Vereins-Admins</span>
        <span className={`text-fg/30 text-sm transition-transform ${open ? 'rotate-180' : ''}`}>▾</span>
      </button>

      {open && (
        <div className="mt-2 space-y-1.5">
          {isLoading && <p className="text-fg/40 text-sm py-1">Lädt…</p>}
          {!isLoading && members.length === 0 && (
            <p className="text-fg/40 text-sm py-1">Noch keine Mitglieder mit Account.</p>
          )}
          {members.map(m => (
            <div key={m.user_id} className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-fg text-sm truncate">{label(m)}</p>
                {m.team_roles.length > 0 && (
                  <p className="text-fg/35 text-xs truncate">{teamHint(m)}</p>
                )}
              </div>
              {m.is_club_admin ? (
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="text-accent-gold text-xs font-semibold">Vereins-Admin</span>
                  <button
                    onClick={() => setClubAdmin(m.user_id, false)}
                    disabled={busy === m.user_id}
                    className="text-red-400 text-xs font-semibold disabled:opacity-50"
                  >entfernen</button>
                </div>
              ) : (
                <button
                  onClick={() => setClubAdmin(m.user_id, true)}
                  disabled={busy === m.user_id}
                  className="text-accent-cyan text-xs font-semibold flex-shrink-0 disabled:opacity-50"
                >{busy === m.user_id ? '…' : 'Zum Admin machen'}</button>
              )}
            </div>
          ))}
          {error && <p className="text-red-400 text-xs pt-1">{error}</p>}
        </div>
      )}
    </div>
  )
}
