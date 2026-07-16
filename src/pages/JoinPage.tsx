import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useQueryClient } from '@tanstack/react-query'
import { useSession } from '../context/SessionProvider'
import { getSupabase } from '../lib/supabase'

export default function JoinPage() {
  const { token } = useParams()
  const { session, user, signInWithOtp, verifyOtp, signOut } = useSession()
  const navigate = useNavigate()
  const qc = useQueryClient()

  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [sent, setSent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const sendCode = async () => {
    if (!email.trim() || busy) return
    setBusy(true); setError(null)
    const { error } = await signInWithOtp(email.trim())
    setBusy(false)
    if (error) setError(error); else setSent(true)
  }

  const submitCode = async () => {
    if (code.trim().length < 6 || busy) return
    setBusy(true); setError(null)
    const { error } = await verifyOtp(email.trim(), code.trim())
    setBusy(false)
    if (error) setError(error)
    // Erfolg → session erscheint → unten der „Einladung annehmen"-Button
  }

  // Redeem ist IMMER explizit (nie automatisch) – schützt davor, dass ein
  // bereits eingeloggter Captain versehentlich ein Profil übernimmt.
  const acceptInvite = async () => {
    if (!token || busy) return
    setBusy(true); setError(null)
    const { error } = await getSupabase().rpc('redeem_invite', { p_raw_token: token })
    setBusy(false)
    if (error) { setError(error.message); return }
    qc.invalidateQueries()
    navigate('/home', { replace: true })
  }

  const inputCls = 'w-full rounded-2xl bg-fg/8 border border-fg/12 px-4 py-3.5 text-fg placeholder-fg/30 outline-none focus:border-accent-pink/60'
  const ctaCls = 'w-full rounded-2xl py-3.5 font-semibold text-white bg-gradient-to-r from-unicorn-violet to-unicorn-pink disabled:opacity-40 transition-opacity'

  return (
    <div className="relative w-full h-dvh min-h-screen overflow-hidden bg-app flex flex-col items-center justify-center px-6">
      <div className="absolute w-[560px] h-[560px] rounded-full bg-unicorn-violet/60 blur-[150px] -top-8 -left-20 pointer-events-none" />
      <div className="absolute w-[370px] h-[370px] rounded-full bg-unicorn-cyan/20 blur-[110px] bottom-10 -right-10 pointer-events-none" />

      <motion.div
        className="relative w-full max-w-sm"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <p className="text-5xl text-center mb-4">🦄</p>
        <h1 className="text-fg font-black text-2xl text-center">Einladung zu Hornstrike</h1>
        <p className="text-accent-pink/80 text-center text-sm mt-1 mb-8 tracking-wide">
          Tritt deinem Team bei
        </p>

        {session ? (
          <div className="space-y-4">
            <p className="text-fg/70 text-sm text-center">
              Eingeloggt als <span className="text-fg font-medium break-all">{user?.email}</span>
            </p>
            <button onClick={acceptInvite} disabled={busy} className={ctaCls}>
              {busy ? 'Nehme an…' : 'Einladung annehmen'}
            </button>
            <button onClick={() => signOut()} className="w-full text-fg/45 text-sm py-1">
              Nicht du? Abmelden
            </button>
          </div>
        ) : !sent ? (
          <div className="space-y-4">
            <input
              type="email" inputMode="email" autoComplete="email" placeholder="deine@mail.de"
              value={email} onChange={e => setEmail(e.target.value)} onKeyDown={e => e.key === 'Enter' && sendCode()}
              className={inputCls}
            />
            <button onClick={sendCode} disabled={busy || !email.trim()} className={ctaCls}>
              {busy ? 'Senden…' : 'Code anfordern'}
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-fg/70 text-sm text-center">
              Code aus der Mail an <span className="text-fg font-medium">{email}</span> eingeben:
            </p>
            <input
              type="text" inputMode="numeric" autoComplete="one-time-code" placeholder="123456" maxLength={6}
              value={code} onChange={e => setCode(e.target.value.replace(/\D/g, ''))} onKeyDown={e => e.key === 'Enter' && submitCode()}
              className={`${inputCls} text-center text-2xl tracking-[0.3em] placeholder-fg/25`}
            />
            <button onClick={submitCode} disabled={busy || code.trim().length < 6} className={ctaCls}>
              {busy ? 'Prüfe…' : 'Weiter'}
            </button>
            <button onClick={() => { setSent(false); setCode(''); setError(null) }} className="w-full text-fg/45 text-sm py-1">
              ← andere E-Mail
            </button>
          </div>
        )}

        {error && <p className="text-red-400 text-sm text-center mt-4">{error}</p>}
      </motion.div>
    </div>
  )
}
