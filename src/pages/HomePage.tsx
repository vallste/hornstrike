import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

import BottomNav from '../components/BottomNav'
import { usePlayers } from '../store'
import { useMatchDays } from '../store'
import { useScope } from '../context/ScopeProvider'

export default function HomePage() {
  const navigate = useNavigate()
  const { players } = usePlayers()
  const { matchDays } = useMatchDays()
  const { workspaces, currentTeamId, setCurrentTeam } = useScope()
  const current = workspaces.find(w => w.teamId === currentTeamId)
  const [switchOpen, setSwitchOpen] = useState(false)
  const lastMatch = [...matchDays].sort((a, b) => b.date.localeCompare(a.date))[0]

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' })

  return (
    <div className="min-h-screen bg-unicorn-purple pb-24 overflow-hidden">
      {/* Ambient glow */}
      <div className="absolute w-[420px] h-[420px] rounded-full bg-unicorn-violet/50 blur-[140px] -top-24 -left-14 pointer-events-none" />

      <div className="relative px-6 pt-12 pb-2">
        <h1 className="text-[26px] font-bold text-white">Hornstrike 🦄</h1>
        {current && (
          <div className="relative mt-1 inline-block">
            <button
              onClick={() => workspaces.length > 1 && setSwitchOpen(o => !o)}
              className="text-white/55 text-sm flex items-center gap-1"
            >
              <span>{current.clubName} · {current.teamName}</span>
              {workspaces.length > 1 && <span className="text-white/40">▾</span>}
            </button>
            {switchOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setSwitchOpen(false)} />
                <div className="absolute left-0 top-7 z-50 bg-[#2b0b4c] border border-white/10 rounded-xl py-1 min-w-[220px] shadow-xl">
                  {workspaces.map(w => (
                    <button
                      key={w.teamId}
                      onClick={() => { setCurrentTeam(w.teamId); setSwitchOpen(false) }}
                      className={`w-full text-left px-3 py-2 text-sm ${w.teamId === currentTeamId ? 'text-unicorn-cyan font-semibold' : 'text-white/80'}`}
                    >
                      {w.clubName} · {w.teamName}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      <div className="relative px-6 mt-4">
        <p className="text-[22px] font-bold text-white">Bereit für den Spieltag?</p>
        <p className="text-unicorn-pink text-sm mt-1">
          {new Date().toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        </p>
      </div>

      {/* Action cards */}
      <div className="relative flex gap-3 px-6 mt-6">
        <button
          onClick={() => navigate('/players')}
          className="flex-1 bg-[#2b0b4c] rounded-2xl p-4 text-left"
        >
          <div className="w-11 h-11 rounded-full bg-unicorn-cyan/20 flex items-center justify-center text-2xl mb-4">👥</div>
          <p className="text-white font-semibold text-lg">Spieler</p>
          <p className="text-white/55 text-xs mt-0.5">{players.length} im Kader</p>
          <div className="mt-3 h-0.5 w-full rounded bg-unicorn-cyan" />
        </button>
        <button
          onClick={() => navigate('/matchday')}
          className="flex-1 bg-[#2b0b4c] rounded-2xl p-4 text-left"
        >
          <div className="w-11 h-11 rounded-full bg-unicorn-pink/20 flex items-center justify-center text-2xl mb-4">⚽</div>
          <p className="text-white font-semibold text-lg">Spieltag</p>
          <p className="text-white/55 text-xs mt-0.5">Aufstellung planen</p>
          <div className="mt-3 h-0.5 w-full rounded bg-unicorn-pink" />
        </button>
      </div>

      {/* Terminfindung */}
      <div className="relative px-6 mt-3">
        <button
          onClick={() => navigate('/terminfindung')}
          className="w-full bg-[#2b0b4c] rounded-2xl p-4 flex items-center gap-3 text-left"
        >
          <div className="w-11 h-11 rounded-full bg-unicorn-gold/20 flex items-center justify-center text-2xl">📅</div>
          <div className="flex-1">
            <p className="text-white font-semibold text-lg">Terminfindung</p>
            <p className="text-white/55 text-xs mt-0.5">Verfügbarkeit fürs Team abfragen</p>
          </div>
          <span className="text-white/25 text-lg">›</span>
        </button>
      </div>

      {/* Last match */}
      <div className="relative px-6 mt-8">
        <p className="text-white/45 text-[13px] font-semibold tracking-wider uppercase mb-3">Letzter Spieltag</p>
        {lastMatch ? (
          <button
            onClick={() => navigate(`/lineup/${lastMatch.id}`)}
            className="w-full bg-[#2b0b4c] rounded-2xl p-4 text-left"
          >
            <p className="text-white font-semibold">{formatDate(lastMatch.date)}</p>
            <p className="text-unicorn-cyan text-sm mt-1">{lastMatch.players.length} Spieler · Aufstellung ansehen</p>
          </button>
        ) : (
          <div className="bg-[#2b0b4c] rounded-2xl p-4">
            <p className="text-white/40 text-sm">Noch kein Spieltag geplant</p>
          </div>
        )}
      </div>

      {/* Tip */}
      <div className="relative px-6 mt-4">
        <div className="bg-[#391060] rounded-xl px-4 py-3">
          <p className="text-white/65 text-[13px] leading-relaxed">
            🦄 Lege zuerst alle Spieler mit ihren Präferenzen an – dann berechnet Hornstrike die optimale Aufstellung für jeden Spieltag.
          </p>
        </div>
      </div>

      <BottomNav />
    </div>
  )
}
