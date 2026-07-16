import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import Header from '../components/Header'
import TimeField from '../components/TimeField'
import { useScope } from '../context/ScopeProvider'
import { getSupabase } from '../lib/supabase'
import { useTrack } from '../lib/analytics'

const pad = (n: number) => String(n).padStart(2, '0')
const iso = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}`
const WD = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So']

export default function PollEditorPage() {
  const navigate = useNavigate()
  const { currentTeamId } = useScope()
  const qc = useQueryClient()
  const track = useTrack()

  const [title, setTitle] = useState('')
  const [deadline, setDeadline] = useState('')
  const [defaultTime, setDefaultTime] = useState('19:00')
  const [defaultLocation, setDefaultLocation] = useState('')
  const [defaultOpponent, setDefaultOpponent] = useState('')
  const [selected, setSelected] = useState<string[]>([])
  const [overrides, setOverrides] = useState<Record<string, { time: string; location: string }>>({})
  const [expanded, setExpanded] = useState<string | null>(null)
  const [view, setView] = useState(() => { const d = new Date(); return { y: d.getFullYear(), m: d.getMonth() } })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const todayStr = new Date().toISOString().split('T')[0]
  const toggleDay = (ds: string) => setSelected(s => (s.includes(ds) ? s.filter(x => x !== ds) : [...s, ds].sort()))
  const setOv = (ds: string, key: 'time' | 'location', val: string) =>
    setOverrides(o => {
      const cur = o[ds] ?? { time: '', location: '' }
      return { ...o, [ds]: { ...cur, [key]: val } }
    })
  const prevMonth = () => setView(v => (v.m === 0 ? { y: v.y - 1, m: 11 } : { y: v.y, m: v.m - 1 }))
  const nextMonth = () => setView(v => (v.m === 11 ? { y: v.y + 1, m: 0 } : { y: v.y, m: v.m + 1 }))

  const daysInMonth = new Date(view.y, view.m + 1, 0).getDate()
  const firstDow = (new Date(view.y, view.m, 1).getDay() + 6) % 7
  const cells: (number | null)[] = [...Array(firstDow).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)]
  const monthName = new Date(view.y, view.m, 1).toLocaleDateString('de-DE', { month: 'long', year: 'numeric' })
  const fmtLong = (ds: string) => new Date(ds + 'T12:00:00').toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric', month: 'long' })

  const canSave = !!title.trim() && selected.length > 0 && !!currentTeamId && !busy

  const create = async () => {
    if (!canSave) return
    setBusy(true); setError(null)
    const sb = getSupabase()
    const { data: poll, error: e1 } = await sb
      .from('polls')
      .insert({
        team_id: currentTeamId as string, title: title.trim(), deadline: deadline || null,
        default_time: defaultTime || null, default_location: defaultLocation.trim() || null,
        default_opponent: defaultOpponent.trim() || null,
      })
      .select('id').single()
    if (e1 || !poll) { setBusy(false); setError(e1?.message ?? 'Fehler'); return }
    const pollId = (poll as { id: string }).id
    const { error: e2 } = await sb.from('poll_options').insert(
      selected.map((ds, i) => ({
        poll_id: pollId, proposed_date: ds, sort_order: i,
        start_time: overrides[ds]?.time || null,
        location: overrides[ds]?.location?.trim() || null,
      })),
    )
    setBusy(false)
    if (e2) { setError(e2.message); return }
    qc.invalidateQueries({ queryKey: ['polls'] })
    track('poll_created', { optionCount: selected.length })
    navigate(`/terminfindung/${pollId}`, { replace: true })
  }

  const fld = 'bg-surface2 rounded-xl px-3 py-2.5 text-fg text-sm placeholder-fg/30 outline-none'

  return (
    <div className="min-h-screen bg-app pb-32">
      <div className="absolute w-[360px] h-[360px] rounded-full bg-unicorn-violet/40 blur-[140px] top-0 right-0 pointer-events-none" />
      <Header title="Neue Umfrage" back />

      <div className="relative px-6 mt-4 space-y-3">
        <div className="bg-surface rounded-2xl px-4 py-3.5">
          <p className="text-fg/45 text-[12px] font-semibold tracking-widest uppercase mb-2">Titel</p>
          <input
            type="text" value={title} onChange={e => setTitle(e.target.value)} autoFocus
            placeholder="z. B. Heimspieltage November"
            className="w-full bg-transparent text-fg placeholder-fg/25 text-[17px] font-semibold outline-none"
          />
        </div>

        <div className="bg-surface rounded-2xl px-4 py-3.5">
          <p className="text-fg/45 text-[12px] font-semibold tracking-widest uppercase mb-2">Standard für alle Termine</p>
          <input type="text" value={defaultOpponent} onChange={e => setDefaultOpponent(e.target.value)} placeholder="Gegner (optional)" className={`${fld} w-full mb-2`} />
          <div className="flex gap-2">
            <TimeField value={defaultTime} onChange={setDefaultTime} className={`${fld} flex-1`} />
            <input type="text" value={defaultLocation} onChange={e => setDefaultLocation(e.target.value)} placeholder="Spielort" className={`${fld} flex-[1.4]`} />
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-3 items-start">
        {/* Kalender-Mehrfachauswahl */}
        <div className="bg-surface rounded-2xl px-4 py-3.5">
          <p className="text-fg/45 text-[12px] font-semibold tracking-widest uppercase">Termine wählen ({selected.length})</p>
          <div className="flex items-center justify-between mt-1 mb-2 max-w-[360px] mx-auto">
            <button onClick={prevMonth} className="text-fg/60 px-3 py-1 text-xl">‹</button>
            <span className="text-fg font-semibold text-sm capitalize">{monthName}</span>
            <button onClick={nextMonth} className="text-fg/60 px-3 py-1 text-xl">›</button>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center max-w-[360px] mx-auto">
            {WD.map(d => <div key={d} className="text-fg/35 text-[11px] py-1">{d}</div>)}
            {cells.map((day, i) => {
              if (day === null) return <div key={i} />
              const ds = iso(view.y, view.m, day)
              const past = ds < todayStr
              const sel = selected.includes(ds)
              return (
                <button
                  key={i} disabled={past} onClick={() => toggleDay(ds)}
                  className={`aspect-square rounded-lg text-sm flex items-center justify-center transition-colors ${
                    sel ? 'bg-unicorn-pink text-white font-bold' : past ? 'text-fg/15' : 'text-fg/80 bg-fg/5 active:bg-fg/10'
                  }`}
                >{day}</button>
              )
            })}
          </div>
        </div>

        {/* Gewählte Termine (Abweichungen / entfernen) */}
        {selected.length > 0 && (
          <div className="bg-surface rounded-2xl px-4 py-3.5">
            <p className="text-fg/45 text-[12px] font-semibold tracking-widest uppercase mb-2">Gewählte Termine</p>
            <div className="space-y-2">
              {selected.map(ds => {
                const ov = overrides[ds]
                const hasOv = !!(ov?.time || ov?.location)
                return (
                  <div key={ds} className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <span className="text-fg text-sm flex-1">{fmtLong(ds)}</span>
                      <button onClick={() => setExpanded(expanded === ds ? null : ds)} className={`text-xs px-2 py-1 rounded-lg flex-shrink-0 ${hasOv ? 'text-accent-gold' : 'text-fg/40'}`}>abw.</button>
                      <button onClick={() => toggleDay(ds)} className="text-fg/40 text-lg px-1 flex-shrink-0">✕</button>
                    </div>
                    {expanded === ds && (
                      <div className="flex gap-2 pl-1">
                        <TimeField value={ov?.time ?? ''} onChange={v => setOv(ds, 'time', v)} className={`${fld} flex-1`} />
                        <input type="text" value={ov?.location ?? ''} onChange={e => setOv(ds, 'location', e.target.value)} placeholder="abw. Ort" className={`${fld} flex-[1.4]`} />
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}
        </div>

        <div className="bg-surface rounded-2xl px-4 py-3.5">
          <p className="text-fg/45 text-[12px] font-semibold tracking-widest uppercase mb-2">Antwort-Deadline (optional)</p>
          <div className="relative bg-surface2 rounded-xl px-3 py-2.5 flex items-center justify-between">
            <span className={deadline ? 'text-fg text-sm' : 'text-fg/40 text-sm'}>
              {deadline ? new Date(deadline + 'T12:00:00').toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' }) : 'keine'}
            </span>
            {deadline && (
              <button onClick={() => setDeadline('')} className="relative z-10 text-fg/40 text-sm px-1">✕</button>
            )}
            <input type="date" lang="de" value={deadline} onChange={e => setDeadline(e.target.value)} onClick={e => e.currentTarget.showPicker?.()} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
          </div>
        </div>

        {error && <p className="text-red-400 text-sm text-center">{error}</p>}
      </div>

      <div className="fixed bottom-0 left-0 right-0 px-6 pb-8 pt-4 bg-gradient-to-t from-app via-app/95 to-transparent">
        <button
          onClick={create} disabled={!canSave}
          className="w-full py-4 rounded-3xl bg-unicorn-pink text-white font-bold text-[17px] disabled:opacity-40 shadow-xl shadow-unicorn-pink/40"
        >
          {busy ? 'Erstelle…' : `Umfrage erstellen (${selected.length})`}
        </button>
      </div>
    </div>
  )
}
