import { useMemo, useState } from 'react'
import { useParams, Navigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import Header from '../components/Header'
import BottomNav from '../components/BottomNav'
import LoadingScreen from '../components/LoadingScreen'
import { usePlayers, useMatchDays } from '../store'
import { useMatchLive, findSet, eventsOfSet } from '../store/live'
import { useCan } from '../lib/permissions'
import { errorMessage } from '../lib/errors'
import {
  getGameSequence, matchSetSlots, matchTotals, setFinished, setPoints, positionsAfterSwitches,
} from '../types'
import type { GameSlot, MatchEvent, OpponentSlot, SetNo } from '../types'

// Live-Erfassung einer Begegnung (Migration 0016).
//
// Leitgedanke: EIN Tipp pro Tor. Wer auf welcher Position steht, weiß die App
// aus der Aufstellung plus den protokollierten Positionswechseln – die Rolle
// muss also niemand auswählen. Alles Feinkörnige ist optional; wer nur
// Endstände will, bleibt in der Satz-Liste.

const ROLE_LABEL: Record<string, string> = { attack: 'Sturm', defense: 'Tor', own_goal: 'Eigentor' }

function eventLabel(ev: MatchEvent, playerName: (id: string) => string, opponentName: (slot: OpponentSlot) => string): string {
  if (ev.kind === 'timeout') return `Timeout ${ev.side === 'us' ? 'wir' : 'Gegner'}`
  if (ev.kind === 'switch') return 'Positionswechsel'
  if (ev.role === 'own_goal') return `Eigentor ${ev.playerId ? playerName(ev.playerId) : ''}`.trim()
  if (ev.side === 'us') {
    return ev.playerId ? `Tor ${playerName(ev.playerId)}${ev.role ? ` (${ROLE_LABEL[ev.role]})` : ''}` : 'Tor für uns'
  }
  return ev.opponentSlot !== null ? `Gegentor ${opponentName(ev.opponentSlot)}` : 'Gegentor'
}

export default function MatchLivePage() {
  const { id } = useParams()
  const { matchDays, isLoading } = useMatchDays()
  if (isLoading) return <LoadingScreen />
  if (!matchDays.find(m => m.id === id)) return <Navigate to="/matchday" replace />
  return <MatchLiveView key={id} />
}

function MatchLiveView() {
  const { id } = useParams()
  const { players } = usePlayers()
  const { matchDays } = useMatchDays()
  const matchDay = matchDays.find(m => m.id === id)!
  const live = useMatchLive(id)
  const canEdit = useCan('team:editLineup')

  const [view, setView] = useState<'live' | 'sets'>('live')
  const [cursor, setCursor] = useState<number | null>(null)
  const [ownGoalOpen, setOwnGoalOpen] = useState(false)

  const useD5 = matchDay.useFifthDouble ?? false
  const sequence = getGameSequence(useD5)
  const slots = useMemo(() => matchSetSlots(useD5), [useD5])
  const totals = matchTotals(live.data.sets, useD5)

  const playerName = (pid: string) => players.find(p => p.id === pid)?.name ?? '?'
  const opponentAt = (gameIndex: number, slot: OpponentSlot) =>
    live.data.opponents.find(o => o.gameIndex === gameIndex && o.slot === slot)?.name ?? ''

  // Aktueller Satz: der erste noch nicht beendete – bis jemand manuell blättert.
  const autoIndex = useMemo(() => {
    const idx = slots.findIndex(sl => {
      const s = findSet(live.data, sl.gameIndex, sl.setNo)
      return !setFinished(s.goalsFor, s.goalsAgainst)
    })
    return idx === -1 ? slots.length - 1 : idx
  }, [slots, live.data])
  const index = cursor ?? autoIndex
  const current = slots[Math.max(0, Math.min(index, slots.length - 1))]

  if (live.isLoading) return <LoadingScreen />

  return (
    <div className="min-h-screen bg-app pb-24">
      <div className="absolute w-[350px] h-[350px] rounded-full bg-unicorn-cyan/15 blur-[120px] top-0 right-0 pointer-events-none" />

      <Header
        title="Ergebnisse"
        back={`/lineup/${matchDay.id}`}
        right={
          live.pending
            ? <span className="text-fg/35 text-[12px]">speichert…</span>
            : matchDay.status === 'live'
              ? <span className="text-accent-cyan text-[12px] font-semibold">● läuft</span>
              : null
        }
      />

      {/* Gesamtstand */}
      <div className="relative px-6 mb-3">
        <div className="bg-surface rounded-2xl px-4 py-3">
          <div className="flex items-end justify-between">
            <div>
              <p className="text-fg/40 text-[11px] font-semibold tracking-wider uppercase mb-1">Satzpunkte</p>
              <p className="text-fg text-[28px] font-bold leading-none">
                {totals.pointsFor}<span className="text-fg/30"> : </span>{totals.pointsAgainst}
              </p>
            </div>
            <div className="text-right">
              <p className="text-fg/40 text-[11px] font-semibold tracking-wider uppercase mb-1">Tore</p>
              <p className="text-fg/70 text-[20px] font-semibold leading-none">
                {totals.goalsFor} : {totals.goalsAgainst}
              </p>
            </div>
          </div>
          <p className="text-fg/35 text-[11px] mt-2">
            {totals.setsFinished} von {totals.setsTotal} Sätzen gespielt
            {matchDay.opponent ? ` · vs. ${matchDay.opponent}` : ''}
          </p>
        </div>
      </div>

      {/* Status + Ansicht */}
      <div className="relative px-6 mb-3 flex items-center gap-2">
        <div className="flex-1 flex bg-surface rounded-xl p-1">
          {(['live', 'sets'] as const).map(v => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`flex-1 py-1.5 rounded-lg text-[13px] font-semibold transition-colors ${
                view === v ? 'bg-surface2 text-fg' : 'text-fg/40'
              }`}
            >
              {v === 'live' ? 'Live' : 'Alle Sätze'}
            </button>
          ))}
        </div>
        {canEdit && (
          <button
            onClick={() => live.setStatus(matchDay.status === 'live' ? 'done' : 'live', matchDay.status === 'live' ? undefined : true)}
            className={`px-3 py-2 rounded-xl text-[13px] font-semibold border flex-shrink-0 ${
              matchDay.status === 'live'
                ? 'border-accent-cyan/50 text-accent-cyan'
                : 'border-fg/20 text-fg/60'
            }`}
          >
            {matchDay.status === 'live' ? 'Beenden' : 'Starten'}
          </button>
        )}
      </div>

      {live.error && (
        <div className="relative px-6 mb-3">
          <p className="bg-red-900/40 border border-red-500/40 rounded-xl px-3 py-2 text-red-200/90 text-[12px]">
            {errorMessage(live.error)}
          </p>
        </div>
      )}

      {view === 'live' ? (
        <LiveSet
          gameIndex={current.gameIndex}
          setNo={current.setNo}
          label={sequence.find(g => g.gameIndex === current.gameIndex)?.label ?? ''}
          lineupSlot={matchDay.lineup.find(s => s.gameIndex === current.gameIndex)}
          live={live}
          canEdit={canEdit}
          playerName={playerName}
          opponentAt={opponentAt}
          ownGoalOpen={ownGoalOpen}
          setOwnGoalOpen={setOwnGoalOpen}
          atStart={index <= 0}
          atEnd={index >= slots.length - 1}
          onPrev={() => { setCursor(Math.max(0, index - 1)); setOwnGoalOpen(false) }}
          onNext={() => { setCursor(Math.min(slots.length - 1, index + 1)); setOwnGoalOpen(false) }}
          onJumpAuto={() => { setCursor(null); setOwnGoalOpen(false) }}
          isAuto={cursor === null}
        />
      ) : (
        <SetList
          slots={slots}
          sequence={sequence}
          lineup={matchDay.lineup}
          live={live}
          canEdit={canEdit}
          playerName={playerName}
          onOpenLive={(gameIndex, setNo) => {
            setCursor(slots.findIndex(s => s.gameIndex === gameIndex && s.setNo === setNo))
            setView('live')
          }}
        />
      )}

      <BottomNav />
    </div>
  )
}

// ── Live-Erfassung eines Satzes ─────────────────────────────────────────────

function LiveSet({
  gameIndex, setNo, label, lineupSlot, live, canEdit, playerName, opponentAt,
  ownGoalOpen, setOwnGoalOpen, atStart, atEnd, onPrev, onNext, onJumpAuto, isAuto,
}: {
  gameIndex: number
  setNo: SetNo
  label: string
  lineupSlot: GameSlot | undefined
  live: ReturnType<typeof useMatchLive>
  canEdit: boolean
  playerName: (id: string) => string
  opponentAt: (gameIndex: number, slot: OpponentSlot) => string
  ownGoalOpen: boolean
  setOwnGoalOpen: (v: boolean) => void
  atStart: boolean
  atEnd: boolean
  onPrev: () => void
  onNext: () => void
  onJumpAuto: () => void
  isAuto: boolean
}) {
  const score = findSet(live.data, gameIndex, setNo)
  const events = eventsOfSet(live.data, gameIndex, setNo)
  const finished = setFinished(score.goalsFor, score.goalsAgainst)
  const isDouble = lineupSlot?.type === 'doubles'

  const switchCount = events.filter(e => e.kind === 'switch' && e.side === 'us').length
  const positions = positionsAfterSwitches(lineupSlot, switchCount)
  const timeoutsUs = events.filter(e => e.kind === 'timeout' && e.side === 'us').length
  const timeoutsThem = events.filter(e => e.kind === 'timeout' && e.side === 'them').length

  const opponents: OpponentSlot[] = isDouble ? [0, 1] : [0]
  const named = opponents.filter(s => opponentAt(gameIndex, s) !== '')
  const last = events[events.length - 1]

  const goal = (side: 'us' | 'them', playerId?: string, role?: 'attack' | 'defense' | 'own_goal', opponentSlot?: OpponentSlot) => {
    if (!canEdit || finished) return
    live.recordEvent({ gameIndex, setNo, kind: 'goal', side, playerId, role, opponentSlot })
    setOwnGoalOpen(false)
  }

  return (
    <div className="relative px-6 space-y-3">
      {/* Kopf mit Blättern */}
      <div className="flex items-center gap-2">
        <button onClick={onPrev} disabled={atStart}
          className="w-9 h-9 rounded-xl bg-surface text-fg/50 text-lg disabled:opacity-25 flex-shrink-0">‹</button>
        <div className="flex-1 text-center">
          <p className="text-fg font-bold text-[15px]">{label} · Satz {setNo}</p>
          {!isAuto && (
            <button onClick={onJumpAuto} className="text-accent-cyan text-[11px] font-semibold">
              zum laufenden Satz
            </button>
          )}
        </div>
        <button onClick={onNext} disabled={atEnd}
          className="w-9 h-9 rounded-xl bg-surface text-fg/50 text-lg disabled:opacity-25 flex-shrink-0">›</button>
      </div>

      {/* Spielstand */}
      <div className={`rounded-2xl px-4 py-5 text-center ${finished ? 'bg-surface2' : 'bg-surface'}`}>
        <p className="text-fg text-[44px] font-bold leading-none tabular-nums">
          {score.goalsFor}<span className="text-fg/25"> : </span>{score.goalsAgainst}
        </p>
        <p className="text-fg/40 text-[12px] mt-2">
          {finished
            ? `Satz beendet · Satzpunkte ${setPoints(score.goalsFor, score.goalsAgainst).join(':')}`
            : `noch offen · bis 6 Tore, Ende spätestens bei 5:5`}
        </p>
      </div>

      {!canEdit && (
        <p className="text-fg/40 text-xs bg-fg/5 rounded-xl px-3 py-2">👁 Nur Ansicht</p>
      )}

      {canEdit && !finished && (
        <>
          {/* Tore für uns – ein Tipp je Tor, Rolle kommt aus der Aufstellung */}
          <div>
            <p className="text-fg/45 text-[11px] font-semibold tracking-wider uppercase mb-1.5">Tor für uns</p>
            <div className="grid grid-cols-2 gap-2">
              {positions.map(p => (
                <button
                  key={p.playerId}
                  onClick={() => goal('us', p.playerId, p.role)}
                  className="bg-surface border border-accent-cyan/30 rounded-2xl px-3 py-4 text-left active:bg-surface2"
                >
                  <p className="text-fg font-semibold text-[15px] truncate">{playerName(p.playerId)}</p>
                  <p className="text-accent-cyan text-[11px] mt-0.5">{ROLE_LABEL[p.role]}</p>
                </button>
              ))}
              {positions.length === 0 && (
                <button onClick={() => goal('us')} className="bg-surface rounded-2xl px-3 py-4 text-fg text-[15px] font-semibold col-span-2">
                  Tor für uns
                </button>
              )}
            </div>
          </div>

          {/* Gegentore */}
          <div>
            <p className="text-fg/45 text-[11px] font-semibold tracking-wider uppercase mb-1.5">Tor für den Gegner</p>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => goal('them')}
                className="bg-surface border border-fg/15 rounded-2xl px-3 py-4 text-fg/80 text-[15px] font-semibold active:bg-surface2"
              >
                Gegentor
              </button>
              <button
                onClick={() => setOwnGoalOpen(!ownGoalOpen)}
                className="bg-surface border border-fg/15 rounded-2xl px-3 py-4 text-fg/60 text-[14px] font-semibold active:bg-surface2"
              >
                Eigentor …
              </button>
            </div>
            {named.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {named.map(slot => (
                  <button
                    key={slot}
                    onClick={() => goal('them', undefined, undefined, slot)}
                    className="bg-surface2 rounded-xl px-3 py-2 text-fg/70 text-[13px]"
                  >
                    durch {opponentAt(gameIndex, slot)}
                  </button>
                ))}
              </div>
            )}
            {ownGoalOpen && (
              <div className="flex flex-wrap gap-2 mt-2">
                {positions.map(p => (
                  <button
                    key={p.playerId}
                    onClick={() => goal('them', p.playerId, 'own_goal')}
                    className="bg-amber-900/40 border border-amber-500/40 rounded-xl px-3 py-2 text-amber-200 text-[13px]"
                  >
                    Eigentor {playerName(p.playerId)}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Timeouts und Positionswechsel */}
          <div className="grid grid-cols-3 gap-2">
            <button
              onClick={() => live.recordEvent({ gameIndex, setNo, kind: 'timeout', side: 'us' })}
              className="bg-surface rounded-xl px-2 py-3 text-fg/70 text-[13px] font-semibold"
            >
              ⏱ wir{timeoutsUs > 0 ? ` (${timeoutsUs})` : ''}
            </button>
            <button
              onClick={() => live.recordEvent({ gameIndex, setNo, kind: 'timeout', side: 'them' })}
              className="bg-surface rounded-xl px-2 py-3 text-fg/70 text-[13px] font-semibold"
            >
              ⏱ sie{timeoutsThem > 0 ? ` (${timeoutsThem})` : ''}
            </button>
            <button
              onClick={() => live.recordEvent({ gameIndex, setNo, kind: 'switch', side: 'us' })}
              disabled={!isDouble}
              className="bg-surface rounded-xl px-2 py-3 text-fg/70 text-[13px] font-semibold disabled:opacity-30"
            >
              ⇄ Wechsel
            </button>
          </div>
        </>
      )}

      {/* Protokoll mit Rücknahme */}
      {(events.length > 0 || finished) && (
        <div className="bg-surface rounded-2xl px-4 py-3">
          <div className="flex items-center justify-between mb-2">
            <p className="text-fg/45 text-[11px] font-semibold tracking-wider uppercase">
              Protokoll{events.length > 0 ? ` (${events.length})` : ''}
            </p>
            {canEdit && last && (
              <button
                onClick={() => live.undoLast(gameIndex, setNo)}
                className="text-accent-pink text-[13px] font-semibold"
              >
                ↩ {eventLabel(last, playerName, s => opponentAt(gameIndex, s))}
              </button>
            )}
          </div>
          {events.length === 0 ? (
            <p className="text-fg/30 text-[12px]">
              Nichts im Detail erfasst. Der Satzstand lässt sich unter „Alle Sätze" auch direkt eintragen.
            </p>
          ) : (
            <div className="space-y-1">
              {events.map(ev => (
                <div key={ev.id} className="flex items-center gap-2 text-[12px]">
                  <span className="text-fg/25 tabular-nums w-5">{ev.seq}</span>
                  <span className={ev.kind === 'goal' ? 'text-fg/75' : 'text-fg/40'}>
                    {eventLabel(ev, playerName, s => opponentAt(gameIndex, s))}
                  </span>
                  {ev.id.startsWith('pending-') && <span className="text-fg/25">·</span>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {finished && !atEnd && canEdit && (
        <motion.button
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          onClick={onNext}
          className="w-full bg-unicorn-pink text-white rounded-2xl py-3.5 font-semibold"
        >
          Weiter zum nächsten Satz →
        </motion.button>
      )}
    </div>
  )
}

// ── Alle Sätze: grobe Erfassung + Gegner-Namen ──────────────────────────────

function SetList({
  slots, sequence, lineup, live, canEdit, playerName, onOpenLive,
}: {
  slots: { gameIndex: number; setNo: SetNo }[]
  sequence: { gameIndex: number; type: string; label: string }[]
  lineup: GameSlot[]
  live: ReturnType<typeof useMatchLive>
  canEdit: boolean
  playerName: (id: string) => string
  onOpenLive: (gameIndex: number, setNo: SetNo) => void
}) {
  const byGame = sequence.map(g => ({
    ...g,
    sets: slots.filter(s => s.gameIndex === g.gameIndex),
    lineupSlot: lineup.find(s => s.gameIndex === g.gameIndex),
  }))

  return (
    <div className="relative px-6 space-y-2">
      {byGame.map(g => (
        <div key={g.gameIndex} className="bg-surface rounded-2xl overflow-hidden">
          <div className="px-4 py-2.5 border-b border-fg/5 flex items-center gap-2">
            <span className={`text-[11px] font-bold w-8 text-center py-0.5 rounded-md flex-shrink-0 ${
              g.type === 'doubles' ? 'bg-unicorn-pink/15 text-accent-pink' : 'bg-unicorn-cyan/15 text-accent-cyan'
            }`}>{g.label}</span>
            <span className="text-fg/70 text-[13px] truncate flex-1">
              {g.lineupSlot?.players.length
                ? g.lineupSlot.players.map(playerName).join(' + ')
                : <span className="text-fg/25">nicht besetzt</span>}
            </span>
          </div>

          {/* Gegnerische Spieler – erst nach Freigabe bekannt, daher nachtragbar */}
          <div className="px-4 py-2 border-b border-fg/5 flex gap-2">
            {(g.type === 'doubles' ? ([0, 1] as OpponentSlot[]) : ([0] as OpponentSlot[])).map(slot => (
              <OpponentInput
                key={slot}
                value={live.data.opponents.find(o => o.gameIndex === g.gameIndex && o.slot === slot)?.name ?? ''}
                disabled={!canEdit}
                placeholder={g.type === 'doubles' ? (slot === 0 ? 'Gegner Sturm' : 'Gegner Tor') : 'Gegner'}
                onCommit={name => live.setOpponent({ gameIndex: g.gameIndex, slot, name })}
              />
            ))}
          </div>

          {g.sets.map(s => (
            <SetRowEditor
              key={s.setNo}
              gameIndex={g.gameIndex}
              setNo={s.setNo}
              live={live}
              canEdit={canEdit}
              onOpenLive={() => onOpenLive(g.gameIndex, s.setNo)}
              showSetNo={g.sets.length > 1}
            />
          ))}
        </div>
      ))}
    </div>
  )
}

function OpponentInput({ value, placeholder, disabled, onCommit }: {
  value: string
  placeholder: string
  disabled: boolean
  onCommit: (name: string) => void
}) {
  const [draft, setDraft] = useState(value)
  // Beim Neuladen von außen den Entwurf nachziehen, solange nicht getippt wird.
  const [focused, setFocused] = useState(false)
  if (!focused && draft !== value) setDraft(value)

  return (
    <input
      value={draft}
      disabled={disabled}
      placeholder={placeholder}
      onFocus={() => setFocused(true)}
      onChange={e => setDraft(e.target.value)}
      onBlur={() => { setFocused(false); if (draft.trim() !== value) onCommit(draft) }}
      className="flex-1 min-w-0 bg-surface2 rounded-lg px-2.5 py-1.5 text-fg text-[13px] placeholder-fg/25 outline-none disabled:opacity-60"
    />
  )
}

function SetRowEditor({ gameIndex, setNo, live, canEdit, onOpenLive, showSetNo }: {
  gameIndex: number
  setNo: SetNo
  live: ReturnType<typeof useMatchLive>
  canEdit: boolean
  onOpenLive: () => void
  showSetNo: boolean
}) {
  const score = findSet(live.data, gameIndex, setNo)
  const events = eventsOfSet(live.data, gameIndex, setNo)
  const goals = events.filter(e => e.kind === 'goal').length
  const total = score.goalsFor + score.goalsAgainst
  const [pf, pa] = setPoints(score.goalsFor, score.goalsAgainst)

  const bump = (field: 'goalsFor' | 'goalsAgainst', delta: number) => {
    if (!canEdit) return
    const next = { ...score, [field]: Math.max(0, Math.min(6, score[field] + delta)) }
    if (next.goalsFor + next.goalsAgainst > 10) return
    live.setScore(next)
  }

  return (
    <div className="px-4 py-2.5 border-b border-fg/5 last:border-b-0 flex items-center gap-2">
      {showSetNo && <span className="text-fg/30 text-[11px] w-10 flex-shrink-0">Satz {setNo}</span>}
      <div className="flex items-center gap-1.5">
        <Stepper value={score.goalsFor} onChange={d => bump('goalsFor', d)} disabled={!canEdit} />
        <span className="text-fg/30">:</span>
        <Stepper value={score.goalsAgainst} onChange={d => bump('goalsAgainst', d)} disabled={!canEdit} />
      </div>
      <div className="flex-1 min-w-0 text-right">
        {setFinished(score.goalsFor, score.goalsAgainst) && (
          <span className="text-fg/45 text-[11px]">{pf}:{pa} Punkte</span>
        )}
        {goals > 0 && goals !== total && (
          <span className="text-amber-400/80 text-[11px] block">
            {goals} von {total} Toren im Detail
          </span>
        )}
      </div>
      <button onClick={onOpenLive} className="text-fg/25 text-lg flex-shrink-0 px-1">›</button>
    </div>
  )
}

function Stepper({ value, onChange, disabled }: { value: number; onChange: (delta: number) => void; disabled: boolean }) {
  return (
    <span className="inline-flex items-center bg-surface2 rounded-lg overflow-hidden">
      <button onClick={() => onChange(-1)} disabled={disabled || value <= 0}
        className="w-7 h-8 text-fg/50 disabled:opacity-25">−</button>
      <span className="w-6 text-center text-fg font-semibold text-[15px] tabular-nums">{value}</span>
      <button onClick={() => onChange(1)} disabled={disabled || value >= 6}
        className="w-7 h-8 text-fg/50 disabled:opacity-25">+</button>
    </span>
  )
}
