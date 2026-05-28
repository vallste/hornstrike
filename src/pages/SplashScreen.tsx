import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'

export default function SplashScreen() {
  const navigate = useNavigate()

  useEffect(() => {
    const t = setTimeout(() => navigate('/home', { replace: true }), 3200)
    return () => clearTimeout(t)
  }, [navigate])

  return (
    <div className="relative w-full h-dvh min-h-screen overflow-hidden bg-unicorn-purple flex flex-col items-center justify-center px-6">
      {/* Ambient glows */}
      <div className="absolute w-[560px] h-[560px] rounded-full bg-unicorn-violet/70 blur-[150px] -top-8 -left-20 pointer-events-none" />
      <div className="absolute w-[370px] h-[370px] rounded-full bg-unicorn-pink/30 blur-[110px] top-64 left-5 pointer-events-none" />
      <div className="absolute w-[430px] h-[430px] rounded-full bg-unicorn-cyan/15 blur-[130px] bottom-0 -left-2 pointer-events-none" />

      {/* Icon area */}
      <motion.div
        className="relative mb-10 flex-shrink-0"
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.7, ease: [0.34, 1.56, 0.64, 1] }}
      >
        {/* Outer ring – responsiv: 44vw aber max 200px */}
        <div
          className="rounded-full border border-unicorn-pink/70 flex items-center justify-center"
          style={{
            width: 'min(44vw, 200px)',
            height: 'min(44vw, 200px)',
            boxShadow: '0 0 40px 8px rgba(224,64,251,0.35)',
          }}
        >
          {/* Inner circle */}
          <div
            className="rounded-full bg-unicorn-violet/80 flex items-center justify-center"
            style={{ width: 'min(31vw, 140px)', height: 'min(31vw, 140px)' }}
          >
            {/* Horn */}
            <motion.div
              initial={{ y: 12, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.4, duration: 0.5 }}
              style={{
                width: 0, height: 0,
                borderLeft: 'min(6.4vw, 29px) solid transparent',
                borderRight: 'min(6.4vw, 29px) solid transparent',
                borderBottom: 'min(19vw, 86px) solid #ffd700',
                filter: 'drop-shadow(0 0 10px rgba(255,215,0,0.6))',
              }}
            />
          </div>
        </div>

        {/* Sparkles */}
        {[
          { x: -52, y: -32, size: 10, color: '#ffd700', delay: 0.6 },
          { x:  62, y: -24, size: 8,  color: '#00e5ff', delay: 0.75 },
          { x: -60, y:  60, size: 6,  color: '#e040fb', delay: 0.65 },
          { x:  68, y:  54, size: 8,  color: '#ffd700', delay: 0.8 },
          { x:  -8, y: -58, size: 8,  color: '#00e5ff', delay: 0.7 },
          { x:  14, y:  88, size: 6,  color: '#e040fb', delay: 0.85 },
        ].map((s, i) => (
          <motion.div
            key={i}
            className="absolute rounded-full"
            style={{ width: s.size, height: s.size, background: s.color, left: '50%', top: '50%', marginLeft: s.x, marginTop: s.y }}
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 0.85 }}
            transition={{ delay: s.delay, duration: 0.4 }}
          />
        ))}
      </motion.div>

      {/* Title – clamp: min 32px, fluid, max 52px */}
      <motion.h1
        className="font-black text-white text-center w-full leading-none"
        style={{ fontSize: 'clamp(32px, 11vw, 52px)', letterSpacing: 'clamp(1px, 0.5vw, 3px)' }}
        initial={{ y: 24, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.55, duration: 0.6 }}
      >
        HORNSTRIKE
      </motion.h1>

      {/* Subtitle */}
      <motion.p
        className="text-unicorn-pink font-light text-center w-full mt-3"
        style={{ fontSize: 'clamp(11px, 3.5vw, 15px)', letterSpacing: 'clamp(2px, 1vw, 5px)' }}
        initial={{ y: 16, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.75, duration: 0.5 }}
      >
        FELLOW UNICORNS
      </motion.p>

      <motion.p
        className="text-white/38 text-xs text-center mt-2"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1, duration: 0.4 }}
      >
        Aufstellungsplaner · Hamburger Liga
      </motion.p>

      {/* Loading dots – safe area aware */}
      <div className="absolute bottom-[max(88px,env(safe-area-inset-bottom,0px)+24px)] flex gap-3.5">
        {[0, 1, 2].map(i => (
          <motion.div
            key={i}
            className="w-2 h-2 rounded-full bg-unicorn-pink"
            initial={{ opacity: 0.25 }}
            animate={{ opacity: [0.25, 1, 0.25] }}
            transition={{ delay: 1.4 + i * 0.18, duration: 0.9, repeat: Infinity, repeatDelay: 0.4 }}
          />
        ))}
      </div>
    </div>
  )
}
