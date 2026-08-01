import { useQuery } from '@tanstack/react-query'
import { getSupabase, isSupabaseConfigured } from './supabase'
import { useSession } from '../context/SessionProvider'
import { usePreviewRole } from '../context/PreviewRoleProvider'
import { useScope } from '../context/ScopeProvider'
import { usePlayers } from '../store'

// Rollen. co_captain steht bewusst NICHT linear in der Hierarchie: darf Inhalte
// wie ein Captain bearbeiten, aber weder einladen noch Rollen vergeben.
// Deshalb explizite Capability-Matrix statt linearem Rang.
export type Role = 'admin' | 'club_admin' | 'team_admin' | 'co_captain' | 'player'

export type Capability =
  | 'player:editOwnPrefs'
  | 'team:editRoster'
  | 'team:editLineup'
  | 'team:createMatchday'
  | 'team:managePolls'
  | 'team:invite'
  | 'team:manageRoles'
  | 'club:manageTeams'
  | 'club:invite'
  | 'app:manageClubs'
  | 'app:viewStats'

// Inhaltsbearbeitung auf Team-Ebene (Kader, Spieltage, Umfragen, Aufstellungen).
const TEAM_EDIT: Capability[] = [
  'player:editOwnPrefs', 'team:editRoster', 'team:editLineup',
  'team:createMatchday', 'team:managePolls',
]

// Explizite Rechte je Rolle.
const CAPS: Record<Role, Capability[]> = {
  player: ['player:editOwnPrefs'],
  co_captain: [...TEAM_EDIT],
  team_admin: [...TEAM_EDIT, 'team:invite', 'team:manageRoles'],
  club_admin: [...TEAM_EDIT, 'team:invite', 'team:manageRoles', 'club:manageTeams', 'club:invite'],
  admin: [...TEAM_EDIT, 'team:invite', 'team:manageRoles', 'club:manageTeams', 'club:invite', 'app:manageClubs', 'app:viewStats'],
}

export function can(role: Role | null, cap: Capability): boolean {
  return !!role && CAPS[role].includes(cap)
}

export const ROLE_LABEL: Record<Role, string> = {
  admin: 'Plattform-Admin',
  club_admin: 'Vereins-Admin',
  team_admin: 'Captain',
  co_captain: 'Co-Captain',
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
      if (currentTeamId && mine.some(m => m.role === 'co_captain' && m.team_id === currentTeamId)) return 'co_captain'
      if (currentTeamId && mine.some(m => m.role === 'player' && m.team_id === currentTeamId)) return 'player'
      return null
    },
  })
  return data ?? null
}

/**
 * Onboarding-Gate:
 *  - 'has'       → Zugriff auf mindestens ein Team (Normalfall).
 *  - 'club-only' → Vereins-Admin/Plattform-Admin, aber (noch) kein Team →
 *                  darf verwalten (Team anlegen), aber team-abhängige Seiten
 *                  ergeben noch keinen Sinn.
 *  - 'none'      → gar kein Zugriff → Verein beantragen.
 */
export function useTeamStatus(): 'loading' | 'has' | 'club-only' | 'none' {
  const { session } = useSession()
  const { workspaces, isLoading, adminClubIds, isPlatformAdmin } = useScope()
  if (!session) return 'none'
  if (isLoading) return 'loading'
  if (workspaces.length > 0) return 'has'
  if (isPlatformAdmin || adminClubIds.length > 0) return 'club-only'
  return 'none'
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
