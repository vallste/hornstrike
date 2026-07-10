import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase, isSupabaseConfigured } from '../lib/supabase'

interface SessionCtx {
  session: Session | null
  user: User | null
  loading: boolean          // true bis getSession() (+ evtl. PKCE-Austausch) fertig ist
  configured: boolean       // false = keine Supabase-Env → App läuft wie bisher lokal
  signInWithOtp: (email: string) => Promise<{ error: string | null }>
  verifyOtp: (email: string, token: string) => Promise<{ error: string | null }>
  signOut: () => Promise<void>
}

const Ctx = createContext<SessionCtx | null>(null)

// Magic-Link/OTP-Redirect landet auf der Nicht-Hash-Basis (…/hornstrike/),
// damit ?code VOR dem # steht und detectSessionInUrl es findet.
const emailRedirectTo = `${window.location.origin}${import.meta.env.BASE_URL}`

export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!supabase) { setLoading(false); return }
    let active = true
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return
      setSession(data.session)
      setLoading(false)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s)
      setLoading(false)
    })
    return () => { active = false; sub.subscription.unsubscribe() }
  }, [])

  const signInWithOtp = async (email: string) => {
    if (!supabase) return { error: 'Supabase nicht konfiguriert' }
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo, shouldCreateUser: true },
    })
    return { error: error?.message ?? null }
  }

  const verifyOtp = async (email: string, token: string) => {
    if (!supabase) return { error: 'Supabase nicht konfiguriert' }
    const { error } = await supabase.auth.verifyOtp({ email, token, type: 'email' })
    return { error: error?.message ?? null }
  }

  const signOut = async () => { await supabase?.auth.signOut() }

  return (
    <Ctx.Provider
      value={{
        session,
        user: session?.user ?? null,
        loading,
        configured: isSupabaseConfigured,
        signInWithOtp,
        verifyOtp,
        signOut,
      }}
    >
      {children}
    </Ctx.Provider>
  )
}

export function useSession() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useSession must be inside SessionProvider')
  return ctx
}
