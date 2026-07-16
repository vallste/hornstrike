import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import Header from '../components/Header'
import { usePlayers } from '../store'
import { useScope } from '../context/ScopeProvider'
import { useCan, ROLE_LABEL, type Role } from '../lib/permissions'
import { getSupabase } from '../lib/supabase'
import { useTrack } from '../lib/analytics'

type MembershipRow = { user_id: string; role: Role }
type InviteRow = { id: string; player_id: string | null; email: string | null; expires_at: string; accepted_at: string | null; revoked_at: string | null }

export default function MembersPage() {
  const { players } = usePlayers()
  const { currentTeamId } = useScope()
  const canInvite = useCan('team:invite')
  const qc = useQueryClient()
  const track = useTrack()

  const [linkFor, setLinkFor] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const { data: memberships = [] } = useQuery({
    queryKey: ['memberships', currentTeamId],
    enabled: !!currentTeamId,
    queryFn: async (): Promise<MembershipRow[]> => {
      const { data, error } = await getSupabase().from('memberships').select('user_id,role').eq('team_id', currentTeamId as string)
      if (error) throw error
      return (data ?? []) as MembershipRow[]
    },
  })
  const roleByUser = new Map(memberships.map(m => [m.user_id, m.role]))

  const { data: invites = [] } = useQuery({
    queryKey: ['invites', currentTeamId],
    enabled: !!currentTeamId && canInvite,
    queryFn: async (): Promise<InviteRow[]> => {
      const { data, error } = await getSupabase()
        .from('invites').select('id,player_id,email,expires_at,accepted_at,revoked_at')
        .eq('team_id', currentTeamId as string)
      if (error) throw error
      return (data ?? []) as InviteRow[]
    },
  })
  const pending = invites.filter(i => !i.accepted_at && !i.revoked_at && new Date(i.expires_at) > new Date())
  const pendingPlayerIds = new Set(pending.map(i => i.player_id).filter(Boolean) as string[])

  const invite = async (playerId: string) => {
    setBusy(playerId); setError(null)
    const { data, error } = await getSupabase().rpc('create_invite', { p_player: playerId, p_role: 'player' })
    setBusy(null)
    if (error) { setError(error.message); return }
    setLinkFor(s => ({ ...s, [playerId]: `${window.location.origin}${import.meta.env.BASE_URL}#/join/${data as string}` }))
    track('invite_created', { source: 'members' })
    qc.invalidateQueries({ queryKey: ['invites'] })
  }
  const revoke = async (id: string) => {
    setBusy(id); setError(null)
    const { error } = await getSupabase().from('invites').update({ revoked_at: new Date().toISOString() }).eq('id', id)
    setBusy(null)
    if (error) { setError(error.message); return }
    qc.invalidateQueries({ queryKey: ['invites'] })
  }
  const copy = (t: string) => { navigator.clipboard?.writeText(t).catch(() => {}) }
  const playerName = (id: string | null) => players.find(p => p.id === id)?.name ?? '—'

  return (
    <div className="min-h-screen bg-app pb-24">
      <div className="absolute w-[360px] h-[360px] rounded-full bg-unicorn-violet/35 blur-[140px] -top-20 right-0 pointer-events-none" />
      <Header title="Mitglieder" back />

      <div className="relative px-6 mt-4 space-y-3">
        <div className="bg-surface rounded-2xl overflow-hidden">
          <div className="px-4 py-3 border-b border-fg/5">
            <p className="text-fg/45 text-[12px] font-semibold tracking-widest uppercase">Kader &amp; Accounts</p>
          </div>
          {players.map(p => {
            const claimed = !!p.userId
            const role = p.userId ? roleByUser.get(p.userId) : undefined
            const hasPending = pendingPlayerIds.has(p.id)
            const link = linkFor[p.id]
            return (
              <div key={p.id} className="px-4 py-3 border-b border-fg/5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-fg text-[15px]">{p.name}</span>
                  {claimed
                    ? <span className="text-accent-cyan text-xs font-semibold">{role ? ROLE_LABEL[role] : 'Account ✓'}</span>
                    : hasPending
                      ? <span className="text-accent-gold text-xs font-semibold">Einladung offen</span>
                      : <span className="text-fg/35 text-xs">kein Account</span>}
                </div>
                {canInvite && !claimed && (
                  <div className="mt-2">
                    {!link ? (
                      <button
                        onClick={() => invite(p.id)} disabled={busy === p.id}
                        className="text-accent-cyan text-sm font-semibold disabled:opacity-50"
                      >{busy === p.id ? 'Erstelle…' : (hasPending ? '↻ Neuen Link erstellen' : '🔗 Einladen')}</button>
                    ) : (
                      <div className="space-y-1.5">
                        <p className="text-fg/55 text-xs break-all bg-black/20 rounded-lg px-2.5 py-1.5">{link}</p>
                        <button onClick={() => copy(link)} className="text-accent-pink text-sm font-semibold">Link kopieren</button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {canInvite && pending.length > 0 && (
          <div className="bg-surface rounded-2xl overflow-hidden">
            <div className="px-4 py-3 border-b border-fg/5">
              <p className="text-fg/45 text-[12px] font-semibold tracking-widest uppercase">Offene Einladungen</p>
            </div>
            {pending.map(i => (
              <div key={i.id} className="px-4 py-3 border-b border-fg/5 flex items-center justify-between gap-2">
                <div>
                  <p className="text-fg text-sm">{playerName(i.player_id)}</p>
                  <p className="text-fg/35 text-xs">gültig bis {new Date(i.expires_at).toLocaleDateString('de-DE')}</p>
                </div>
                <button
                  onClick={() => revoke(i.id)} disabled={busy === i.id}
                  className="text-red-400 text-sm font-semibold disabled:opacity-50"
                >Widerrufen</button>
              </div>
            ))}
          </div>
        )}

        {error && <p className="text-red-400 text-sm text-center">{error}</p>}
      </div>
    </div>
  )
}
