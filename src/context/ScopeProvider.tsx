import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getSupabase, isSupabaseConfigured } from '../lib/supabase'
import { useSession } from './SessionProvider'

export interface Workspace {
  teamId: string
  teamName: string
  clubId: string
  clubName: string
}

interface Ctx {
  workspaces: Workspace[]
  currentTeamId: string | null
  currentClubId: string | null
  setCurrentTeam: (id: string) => void
  isLoading: boolean
  /** Vereine, in denen der User Vereins-Admin ist (auch ohne Team). */
  adminClubIds: string[]
  isPlatformAdmin: boolean
}

const ScopeContext = createContext<Ctx | null>(null)
const LS_KEY = 'hornstrike_current_team'

type TeamRow = { id: string; name: string; club_id: string; clubs: { name: string } | { name: string }[] | null }

/**
 * Aktueller Arbeitskontext (Verein/Team). Listet alle Teams, auf die der User
 * Zugriff hat (RLS), und hält die Auswahl (persistiert). Datenschicht scoped
 * ihre Queries auf currentTeamId.
 */
export function ScopeProvider({ children }: { children: ReactNode }) {
  const { session } = useSession()
  const uid = session?.user.id

  const { data: workspaces = [], isLoading } = useQuery({
    queryKey: ['workspaces', uid],
    enabled: isSupabaseConfigured && !!uid,
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<Workspace[]> => {
      const { data, error } = await getSupabase()
        .from('teams')
        .select('id,name,club_id,clubs(name)')
        .order('name', { ascending: true })
      if (error) throw error
      return ((data ?? []) as TeamRow[]).map(t => {
        const club = Array.isArray(t.clubs) ? t.clubs[0] : t.clubs
        return { teamId: t.id, teamName: t.name, clubId: t.club_id, clubName: club?.name ?? '—' }
      })
    },
  })

  // Zugriff, der NICHT an ein Team hängt: Vereins-Admin (Verein ohne Team) und
  // Plattform-Admin. Verhindert die Onboarding-Sackgasse „hat Verein, aber noch
  // kein Team" → würde sonst dauerhaft auf /request-club gesperrt.
  const { data: access, isLoading: accessLoading } = useQuery({
    queryKey: ['scopeAccess', uid],
    enabled: isSupabaseConfigured && !!uid,
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<{ adminClubIds: string[]; isPlatformAdmin: boolean }> => {
      const sb = getSupabase()
      const [prof, mems] = await Promise.all([
        sb.from('profiles').select('is_platform_admin').eq('id', uid as string).maybeSingle(),
        sb.from('memberships').select('club_id,role,user_id').eq('role', 'club_admin'),
      ])
      const isPlatformAdmin = !!(prof.data as { is_platform_admin?: boolean } | null)?.is_platform_admin
      const adminClubIds = ((mems.data ?? []) as { club_id: string | null; user_id: string }[])
        .filter(m => m.user_id === uid && m.club_id)
        .map(m => m.club_id as string)
      return { adminClubIds, isPlatformAdmin }
    },
  })
  const adminClubIds = access?.adminClubIds ?? []
  const isPlatformAdmin = access?.isPlatformAdmin ?? false

  const [selected, setSelected] = useState<string | null>(() => {
    try { return localStorage.getItem(LS_KEY) } catch { return null }
  })

  const currentTeamId = useMemo(() => {
    if (!workspaces.length) return null
    if (selected && workspaces.some(w => w.teamId === selected)) return selected
    return workspaces[0].teamId
  }, [workspaces, selected])

  useEffect(() => {
    if (currentTeamId && currentTeamId !== selected) {
      try { localStorage.setItem(LS_KEY, currentTeamId) } catch { /* ignore */ }
    }
  }, [currentTeamId, selected])

  const setCurrentTeam = (id: string) => {
    try { localStorage.setItem(LS_KEY, id) } catch { /* ignore */ }
    setSelected(id)
  }

  const currentClubId = workspaces.find(w => w.teamId === currentTeamId)?.clubId ?? null

  return (
    <ScopeContext.Provider value={{
      workspaces, currentTeamId, currentClubId, setCurrentTeam,
      isLoading: isLoading || accessLoading, adminClubIds, isPlatformAdmin,
    }}>
      {children}
    </ScopeContext.Provider>
  )
}

export function useScope() {
  const ctx = useContext(ScopeContext)
  if (!ctx) throw new Error('useScope must be inside ScopeProvider')
  return ctx
}
