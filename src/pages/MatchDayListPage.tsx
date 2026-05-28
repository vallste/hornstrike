import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Header from '../components/Header'
import BottomNav from '../components/BottomNav'
import { useMatchDays, usePlayers } from '../store'

export default function MatchDayListPage() {
  const navigate = useNavigate()
  const { matchDays, deleteMatchDay } = useMatchDays()
  const { players } = usePlayers()

  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const sorted = [...matchDays].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

  const playerName = (id: string) => players.find(p => p.id === id)?.name ?? '?'

  const formatDate = (iso: string) =>
    new Date(iso + 'T12:00:00').toLocaleDateString('de-DE', {
      weekday: 'short', day: 'numeric', month: 'long', year: 'numeric',
    })

  return (
    <div className="min-h-screen bg-unicorn-purple pb-24">
      <div className="absolute w-[380px] h-[380px] rounded-full bg-unicorn-violet/35 blur-[130px] -top-20 right-0 pointer-events-none" />

      <Header
        title="Spieltage"
        right={
          <button
            onClick={() => navigate('/matchday/new')}
            className="w-9 h-9 rounded-full bg-unicorn-pink flex items-center justify-center text-white text-2xl font-bold shadow-lg shadow-unicorn-pink/40"
          >+</button>
        }
      />

      <div className="relative px-6 space-y-3 mt-4">
        {sorted.length === 0 && (
          <div className="bg-[#2b0b4c] rounded-2xl p-6 text-center">
            <p className="text-4xl mb-3">⚽</p>
            <p className="text-white font-semibold">Noch kein Spieltag geplant</p>
            <p className="text-white/45 text-sm mt-1 mb-4">Tippe auf „+ Neu" um loszulegen.</p>
            <button
              onClick={() => navigate('/matchday/new')}
              className="bg-unicorn-pink text-white font-bold px-6 py-3 rounded-2xl shadow-lg shadow-unicorn-pink/40"
            >
              Spieltag planen ✨
            </button>
          </div>
        )}

        {sorted.map(md => {
          const activeNames = md.players
            .slice(0, 4)
            .map(p => playerName(p.playerId))
          const more = md.players.length - 4

          return (
            <div key={md.id} className="bg-[#2b0b4c] rounded-2xl overflow-hidden">
              <button
                className="w-full px-4 py-4 text-left"
                onClick={() => navigate(`/lineup/${md.id}`)}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-semibold text-[15px]">{formatDate(md.date)}</p>
                    {md.opponent && (
                      <p className="text-unicorn-cyan text-sm mt-0.5">vs. {md.opponent}</p>
                    )}
                    <p className="text-white/45 text-xs mt-1.5">
                      {activeNames.join(', ')}{more > 0 ? ` +${more}` : ''} · {md.players.length} Spieler
                    </p>
                  </div>
                  <span className="text-white/25 text-xl mt-0.5">›</span>
                </div>
              </button>

              {/* Quick actions */}
              {confirmDelete === md.id ? (
                <div className="flex border-t border-white/5 bg-red-900/20">
                  <span className="flex-1 py-2.5 px-4 text-red-300 text-[13px]">Wirklich löschen?</span>
                  <button
                    onClick={() => { deleteMatchDay(md.id); setConfirmDelete(null) }}
                    className="px-4 py-2.5 text-red-400 text-[13px] font-bold border-l border-white/5"
                  >
                    Ja
                  </button>
                  <button
                    onClick={() => setConfirmDelete(null)}
                    className="px-4 py-2.5 text-white/50 text-[13px] border-l border-white/5"
                  >
                    Nein
                  </button>
                </div>
              ) : (
                <div className="flex border-t border-white/5">
                  <button
                    onClick={() => navigate(`/lineup/${md.id}`)}
                    className="flex-1 py-2.5 text-unicorn-cyan text-[13px] font-semibold"
                  >
                    Aufstellung ansehen
                  </button>
                  <div className="w-px bg-white/5" />
                  <button
                    onClick={() => setConfirmDelete(md.id)}
                    className="px-4 py-2.5 text-white/35 text-[13px]"
                  >
                    🗑
                  </button>
                </div>
              )}
            </div>
          )
        })}
      </div>

      <BottomNav />
    </div>
  )
}
