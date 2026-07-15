import { useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useSession } from '../context/SessionProvider'

export default function LoginPage() {
  const { session, configured, signInWithOtp, verifyOtp } = useSession()
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as { from?: { pathname: string } } | null)?.from?.pathname ?? '/home'

  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [sent, setSent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Schon eingeloggt? → weiter in die App.
  if (session) return <Navigate to={from} replace />

  const sendLink = async () => {
    if (!email.trim() || busy) return
    setBusy(true); setError(null)
    const { error } = await signInWithOtp(email.trim())
    setBusy(false)
    if (error) setError(error)
    else setSent(true)
  }

  const submitCode = async () => {
    if (code.trim().length < 6 || busy) return  // akzeptiert 6–8-stellige OTPs
    setBusy(true); setError(null)
    const { error } = await verifyOtp(email.trim(), code.trim())
    setBusy(false)
    if (error) setError(error)
    else navigate(from, { replace: true })
  }

  return (
    <div className="relative w-full h-dvh min-h-screen overflow-hidden bg-unicorn-purple flex flex-col items-center justify-center px-6">
      <div className="absolute w-[560px] h-[560px] rounded-full bg-unicorn-violet/60 blur-[150px] -top-8 -left-20 pointer-events-none" />
      <div className="absolute w-[370px] h-[370px] rounded-full bg-unicorn-pink/25 blur-[110px] bottom-10 -right-10 pointer-events-none" />

      <motion.div
        className="relative w-full max-w-sm"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <h1 className="text-white font-black text-3xl text-center">Hornstrike</h1>
        <p className="text-unicorn-pink/80 text-center text-sm mt-1 mb-8 tracking-wide">Anmelden per E-Mail</p>

        {!configured && (
          <p className="text-amber-300/90 text-sm text-center mb-4">
            Supabase ist nicht konfiguriert – Login nicht verfügbar.
          </p>
        )}

        {!sent ? (
          <div className="space-y-4">
            <input
              type="email"
              inputMode="email"
              autoComplete="email"
              placeholder="deine@mail.de"
              value={email}
              onChange={e => setEmail(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && sendLink()}
              className="w-full rounded-2xl bg-white/8 border border-white/12 px-4 py-3.5 text-white placeholder-white/30 outline-none focus:border-unicorn-pink/60"
            />
            <button
              onClick={sendLink}
              disabled={!configured || busy || !email.trim()}
              className="w-full rounded-2xl py-3.5 font-semibold text-white bg-gradient-to-r from-unicorn-violet to-unicorn-pink disabled:opacity-40 transition-opacity"
            >
              {busy ? 'Senden…' : 'Magic-Link senden'}
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-white/70 text-sm text-center">
              Wir haben dir eine Mail an <span className="text-white font-medium">{email}</span> geschickt.
              Klicke den Link – oder gib den 6-stelligen Code ein:
            </p>
            <input
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="123456"
              maxLength={6}
              value={code}
              onChange={e => setCode(e.target.value.replace(/\D/g, ''))}
              onKeyDown={e => e.key === 'Enter' && submitCode()}
              className="w-full rounded-2xl bg-white/8 border border-white/12 px-4 py-3.5 text-white text-center text-2xl tracking-[0.3em] placeholder-white/25 outline-none focus:border-unicorn-pink/60"
            />
            <button
              onClick={submitCode}
              disabled={busy || code.trim().length < 6}
              className="w-full rounded-2xl py-3.5 font-semibold text-white bg-gradient-to-r from-unicorn-violet to-unicorn-pink disabled:opacity-40 transition-opacity"
            >
              {busy ? 'Prüfe…' : 'Anmelden'}
            </button>
            <button
              onClick={() => { setSent(false); setCode(''); setError(null) }}
              className="w-full text-white/45 text-sm py-1"
            >
              ← andere E-Mail
            </button>
          </div>
        )}

        {error && <p className="text-red-400 text-sm text-center mt-4">{error}</p>}
      </motion.div>
    </div>
  )
}
