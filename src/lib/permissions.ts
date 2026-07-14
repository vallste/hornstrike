import { useQuery } from '@tanstack/react-query'
import { getSupabase, isSupabaseConfigured } from './supabase'
import { useSession } from '../context/SessionProvider'
import { usePreviewRole } from '../context/PreviewRoleProvider'
import { useScope } from '../context/ScopeProvider'
import { usePlayers } from '../store'

// Rollen sind hierarchisch: admin ⊇ club_admin ⊇ team_admin ⊇ player.
export type Role = 'admin' | 'club_admin' | 'team_admin' | 'player'

export type Capability =
  | 'player:editOwnPrefs'
  | 'team:editRoster'
  | 'team:editLineup'
  | 'team:createMatchday'
  | 'team:managePolls'
  | 'team:invite'
  | 'club:manageTeams'
  | 'club:invite'
  | 'app:manageClubs'

const RANK: Record<Role, number> = { player: 0, team_admin: 1, club_admin: 2, admin: 3 }

// Mindest-Rolle je Capability (hierarchisch ausgewertet).
const MIN_ROLE: Record<Capability, Role> = {
  'player:editOwnPrefs': 'player',
  'team:editRoster': 'team_admin',
  'team:editLineup': 'team_admin',
  'team:createMatchday': 'team_admin',
  'team:managePolls': 'team_admin',
  'team:invite': 'team_admin',
  'club:manageTeams': 'club_admin',
  'club:invite': 'club_admin',
  'app:manageClubs': 'admin',
}

export function can(role: Role | null, cap: Capability): boolean {
  if (!role) return false
  return RANK[role] >= RANK[MIN_ROLE[cap]]
}

export const ROLE_LABEL: Record<Role, string> = {
  admin: 'Plattform-Admin',
  club_admin: 'Vereins-Admin',
  team_admin: 'Captain',
  player: 'Spieler',
}

type MembershipRow = { role: Role; team_id: string | null; club_id: string | null; user_id: string }

/**
 * Effektive Rolle des eingeloggten Users im aktuellen (einzigen) Team.
 * Spiegelt die Server-Hierarchie: Plattform-Admin ⊇ Club-Admin ⊇ Captain ⊇ Spieler.
 * Die echte Absicherung macht RLS – das hier steuert nur die UI.
 */
// Rolle immer bezogen auf das AKTUELLE Team/den aktuellen Verein (Scope).
export function useRealRole(): Role | null {
  const { session } = useSession()
  const { currentTeamId, currentClubId, isLoading: scopeLoading } = useScope()
  const uid = session?.user.id
  const { data } = useQuery({
    queryKey: ['role', uid, currentTeamId, currentClubId],
    enabled: isSupabaseConfigured && !!uid && !scopeLoading,
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<Role | null> => {
      const sb = getSupabase()
      const [prof, mems] = await Promise.all([
        sb.from('profiles').select('is_platform_admin').eq('id', uid as string).maybeSingle(),
        sb.from('memberships').select('role,team_id,club_id,user_id'),
      ])
      if ((prof.data as { is_platform_admin?: boolean } | null)?.is_platform_admin) return 'admin'
      const mine = ((mems.data ?? []) as MembershipRow[]).filter(m => m.user_id === uid)
      if (currentClubId && mine.some(m => m.role === 'club_admin' && m.club_id === currentClubId)) return 'club_admin'
      if (currentTeamId && mine.some(m => m.role === 'team_admin' && m.team_id === currentTeamId)) return 'team_admin'
      if (currentTeamId && mine.some(m => m.role === 'player' && m.team_id === currentTeamId)) return 'player'
      return null
    },
  })
  return data ?? null
}

/** Onboarding-Gate: hat der eingeloggte User Zugriff auf mindestens ein Team? */
export function useTeamStatus(): 'loading' | 'has' | 'none' {
  const { session } = useSession()
  const { workspaces, isLoading } = useScope()
  if (!session) return 'none'
  if (isLoading) return 'loading'
  return workspaces.length > 0 ? 'has' : 'none'
}

/** Effektive UI-Rolle inkl. Admin-Vorschaumodus (previewRole überschreibt die echte). */
export function useRole(): Role | null {
  const { previewRole } = usePreviewRole()
  const real = useRealRole()
  return previewRole ?? real
}

export function useCan(cap: Capability): boolean {
  return can(useRole(), cap)
}

/**
 * ID der Spieler-Zeile, die dem eingeloggten User gehört (bzw. im Vorschaumodus
 * der ausgewählte Spieler). Basis für „darf nur eigenes Profil bearbeiten".
 */
export function useMyPlayerId(): string | null {
  const { session } = useSession()
  const { previewRole, previewPlayerId } = usePreviewRole()
  const { players } = usePlayers()
  if (previewRole === 'player') return previewPlayerId
  const uid = session?.user.id
  return players.find(p => p.userId === uid)?.id ?? null
}
