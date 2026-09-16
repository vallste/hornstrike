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
  setDuration, formatDuration,
} from '../types'
import type { GameSlot, MatchEvent, MatchSet, OpponentSlot, SetNo } from '../types'

// Live-Erfassung einer Begegnung (Migration 0016).
//
// Leitgedanke: EIN Tipp pro Tor. Wer auf welcher Position steht, weiß die App
// aus der Aufstellung plus den protokollierten Positionswechseln – die Rolle
// muss also niemand auswählen. Alles Feinkörnige ist optional; wer nur
// Endstände will, bleibt in der Satz-Liste.

const ROLE_LABEL: Record<string, string> = { attack: 'Sturm', defense: 'Tor', own_goal: 'Eigentor' }

function eventLabel(ev: MatchEvent, playerName: (id: string) => string, opponentName: (slot: OpponentSlot) => string): string {
  if (ev.kind === 'timeout') return `Timeout ${ev.side === 'us' ? 'wir' : 'Gegner'}`
  if (ev.kind === 'switch') return `Positionswechsel ${ev.side === 'us' ? 'wir' : 'Gegner'}`
  if (ev.role === 'own_goal') {
    // Eigentor von uns: zaehlt fuer sie, verursacht von unserer Person.
    // Eigentor des Gegners: zaehlt fuer uns, ohne Namen – wir kennen ihn nicht.
    return ev.playerId ? `Eigentor ${playerName(ev.playerId)}` : 'Eigentor des Gegners'
  }
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

/**
 * Warum eine Eingabe nicht angenommen wurde – in Worten, nicht in Codes.
 * „seq_taken" ist der haeufigste Fall: zwei Leute haben dasselbe Tor getippt.
 */
const REJECTION_TEXT: Record<string, string> = {
  seq_taken: 'war schon erfasst',
  duplicate: 'war schon erfasst',
  set_finished: 'Satz war bereits zu Ende',
  already_undone: 'schon zurückgenommen',
  nothing_to_undo: 'nichts zurückzunehmen',
}

function rejectionSummary(rejected: { reason: string }[]): string {
  const seen: string[] = []
  for (const r of rejected) {
    const text = REJECTION_TEXT[r.reason] ?? 'nicht gespeichert'
    if (!seen.includes(text)) seen.push(text)
  }
  return seen.join(' · ')
}

function MatchLiveView() {
  const { id } = useParams()
  const { players } = usePlayers()
  const { matchDays } = useMatchDays()
  const matchDay = matchDays.find(m => m.id === id)!
  const live = useMatchLive(id)
  const canEdit = useCan('team:editLineup')
  // Ein noch wartender Statuswechsel zaehlt fuer die Anzeige schon – sonst
  // spränge der Knopf nach dem Tippen zurueck, bis die Verbindung steht.
  const status = live.pendingStatus ?? matchDay.status ?? 'planned'

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
          live.pendingCount > 0
            ? <span className={`text-[12px] font-semibold ${live.online ? 'text-fg/45' : 'text-amber-300'}`}>
                {live.online ? '↻' : '⏸'} {live.pendingCount}
              </span>
            : status === 'live'
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
            onClick={() => live.setStatus(status === 'live' ? 'done' : 'live', status === 'live' ? undefined : true)}
            className={`px-3 py-2 rounded-xl text-[13px] font-semibold border flex-shrink-0 ${
              status === 'live'
                ? 'border-accent-cyan/50 text-accent-cyan'
                : 'border-fg/20 text-fg/60'
            }`}
          >
            {status === 'live' ? 'Beenden' : 'Starten'}
          </button>
        )}
      </div>

      {live.pendingCount > 0 && (
        <div className="relative px-6 mb-3">
          <div className={`rounded-xl px-3 py-2 text-[12px] border flex items-center gap-2 ${
            live.online
              ? 'bg-surface border-fg/10 text-fg/60'
              : 'bg-amber-900/25 border-amber-500/40 text-amber-200/90'
          }`}>
            <span className={live.syncing ? 'animate-pulse' : ''}>{live.online ? '↻' : '⏸'}</span>
            <span className="flex-1">
              <b className="font-semibold">{live.pendingCount}</b>
              {live.pendingCount === 1 ? ' Eingabe' : ' Eingaben'}
              {live.online
                ? ' noch nicht gespeichert – läuft'
                : ' warten auf Verbindung'}
            </span>
          </div>
          <p className="text-fg/30 text-[11px] mt-1 px-1">
            Bleibt erhalten, auch wenn du die App schließt.
          </p>
        </div>
      )}

      {live.rejected.length > 0 && (
        <div className="relative px-6 mb-3">
          <div className="bg-amber-900/30 border border-amber-500/40 rounded-xl px-3 py-2">
            <p className="text-amber-200/90 text-[12px]">
              <b className="font-semibold">{live.rejected.length}</b>
              {live.rejected.length === 1 ? ' Eingabe wurde' : ' Eingaben wurden'} nicht übernommen:
              {' '}{rejectionSummary(live.rejected)}
            </p>
            <p className="text-amber-200/60 text-[11px] mt-1">
              Prüf den Satzstand und trag ihn bei Bedarf unter „Alle Sätze" von Hand ein.
            </p>
            <button
              onClick={live.dismissRejected}
              className="mt-2 text-amber-200/80 text-[12px] font-semibold underline"
            >
              Verstanden
            </button>
          </div>
        </div>
      )}

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
          prev={index > 0 ? {
            label: sequence.find(g => g.gameIndex === slots[index - 1].gameIndex)?.label ?? '',
            setNo: slots[index - 1].setNo,
            sameGame: slots[index - 1].gameIndex === current.gameIndex,
            score: findSet(live.data, slots[index - 1].gameIndex, slots[index - 1].setNo),
          } : null}
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
  gameIndex, setNo, label, lineupSlot, prev, live, canEdit, playerName, opponentAt,
  ownGoalOpen, setOwnGoalOpen, atStart, atEnd, onPrev, onNext, onJumpAuto, isAuto,
}: {
  gameIndex: number
  setNo: SetNo
  label: string
  lineupSlot: GameSlot | undefined
  prev: { label: string; setNo: SetNo; sameGame: boolean; score: MatchSet } | null
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
  const started = !!score.startedAt
  const isDouble = lineupSlot?.type === 'doubles'
  const duration = setDuration(score)

  const switchCount = events.filter(e => e.kind === 'switch' && e.side === 'us').length
  const positions = positionsAfterSwitches(lineupSlot, switchCount)
  const timeoutsUs = events.filter(e => e.kind === 'timeout' && e.side === 'us').length
  const timeoutsThem = events.filter(e => e.kind === 'timeout' && e.side === 'them').length

  const opponents: OpponentSlot[] = isDouble ? [0, 1] : [0]
  const last = events[events.length - 1]

  const opponentLabel = (slot: OpponentSlot) =>
    opponentAt(gameIndex, slot) || (isDouble ? (slot === 0 ? 'Gegner:in Sturm' : 'Gegner:in Tor') : 'Gegner:in')

  const goal = (side: 'us' | 'them', playerId?: string, role?: 'attack' | 'defense' | 'own_goal', opponentSlot?: OpponentSlot) => {
    if (!canEdit || finished) return
    live.recordEvent({ gameIndex, setNo, kind: 'goal', side, playerId, role, opponentSlot })
    setOwnGoalOpen(false)
  }
  const mark = (kind: 'timeout' | 'switch', side: 'us' | 'them') => {
    if (!canEdit || finished) return
    live.recordEvent({ gameIndex, setNo, kind, side })
  }
  // Eigentor von uns: im Einzel eindeutig, im Doppel muss die Person gewählt werden.
  const ownGoalByUs = () => {
    if (!canEdit || finished) return
    if (positions.length === 1) goal('them', positions[0].playerId, 'own_goal')
    else setOwnGoalOpen(!ownGoalOpen)
  }

  const sideBox = 'bg-surface rounded-2xl p-3'
  const bigBtn = 'rounded-2xl px-3 py-4 text-left active:opacity-70'
  const smallBtn = 'rounded-xl px-2 py-3 text-[12px] font-semibold active:opacity-70 disabled:opacity-25'

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
            ? `Satz beendet · Satzpunkte ${setPoints(score.goalsFor, score.goalsAgainst).join(':')}${duration ? ` · ${formatDuration(duration)} min` : ''}`
            : started
              ? 'läuft · bis 6 Tore, Ende spätestens bei 5:5'
              : 'noch nicht angepfiffen'}
        </p>
      </div>

      {!canEdit && (
        <p className="text-fg/40 text-xs bg-fg/5 rounded-xl px-3 py-2">👁 Nur Ansicht</p>
      )}

      {/* Zwischenschirm: Ergebnis davor, wer jetzt spielt, „Go".
          `!finished` ist wichtig fuer Altbestand: Saetze aus der Zeit vor 0019
          haben keinen Anpfiff und wuerden sonst rueckwirkend einen anbieten. */}
      {canEdit && !started && !finished && (
        <div className="bg-surface rounded-2xl px-4 py-5 space-y-4">
          {prev && setFinished(prev.score.goalsFor, prev.score.goalsAgainst) && (
            <div className="text-center">
              <p className="text-fg/40 text-[11px] font-semibold tracking-wider uppercase">
                {prev.sameGame ? `${prev.label} · Satz ${prev.setNo}` : `davor: ${prev.label} · Satz ${prev.setNo}`}
              </p>
              <p className="text-fg/80 text-[20px] font-bold mt-1 tabular-nums">
                {prev.score.goalsFor} : {prev.score.goalsAgainst}
                <span className="text-fg/35 text-[13px] font-medium">
                  {' '}({setPoints(prev.score.goalsFor, prev.score.goalsAgainst).join(':')})
                </span>
              </p>
            </div>
          )}

          <div className="border-t border-fg/10 pt-4">
            <p className="text-fg/40 text-[11px] font-semibold tracking-wider uppercase text-center mb-3">
              {prev?.sameGame ? 'Jetzt: zweiter Satz' : 'Jetzt am Tisch'}
            </p>
            <div className="flex items-stretch gap-2">
              <div className="flex-1 space-y-1">
                {positions.length > 0 ? positions.map(p => (
                  <div key={p.playerId} className="bg-surface2 rounded-xl px-3 py-2">
                    <p className="text-fg text-[14px] font-semibold truncate">{playerName(p.playerId)}</p>
                    <p className="text-accent-cyan text-[11px]">{ROLE_LABEL[p.role]}</p>
                  </div>
                )) : (
                  <div className="bg-surface2 rounded-xl px-3 py-2">
                    <p className="text-fg/35 text-[13px]">niemand aufgestellt</p>
                  </div>
                )}
              </div>
              <div className="flex items-center text-fg/25 text-[13px] font-bold">vs</div>
              <div className="flex-1 space-y-1">
                {opponents.map(slot => (
                  <div key={slot} className="bg-surface2 rounded-xl px-3 py-2">
                    <p className={`text-[14px] font-semibold truncate ${opponentAt(gameIndex, slot) ? 'text-fg' : 'text-fg/35'}`}>
                      {opponentLabel(slot)}
                    </p>
                    {isDouble && <p className="text-fg/35 text-[11px]">{slot === 0 ? 'Sturm' : 'Tor'}</p>}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <button
            onClick={() => live.startSet(gameIndex, setNo)}
            className="w-full rounded-2xl py-4 bg-accent-cyan text-[#1a0533] text-[17px] font-bold active:opacity-80"
          >
            Go
          </button>
          <p className="text-fg/30 text-[11px] text-center">
            Startet die Zeitmessung für diesen Satz.
          </p>
        </div>
      )}

      {canEdit && started && !finished && (
        <>
          {/* ── Wir ──────────────────────────────────────────────────────── */}
          <div className={sideBox}>
            <p className="text-accent-cyan text-[11px] font-semibold tracking-wider uppercase mb-2">Wir</p>
            <div className="grid grid-cols-2 gap-2">
              {positions.length > 0 ? positions.map(p => (
                <button
                  key={p.playerId}
                  onClick={() => goal('us', p.playerId, p.role)}
                  className={`${bigBtn} bg-surface2 border border-accent-cyan/40`}
                >
                  <p className="text-fg font-semibold text-[15px] truncate">{playerName(p.playerId)}</p>
                  <p className="text-accent-cyan text-[11px] mt-0.5">Tor · {ROLE_LABEL[p.role]}</p>
                </button>
              )) : (
                <button onClick={() => goal('us')} className={`${bigBtn} bg-surface2 border border-accent-cyan/40 col-span-2 text-center`}>
                  <p className="text-fg font-semibold text-[15px]">Tor für uns</p>
                </button>
              )}
            </div>
            <div className="grid grid-cols-3 gap-2 mt-2">
              <button onClick={() => goal('us', undefined, 'own_goal')} className={`${smallBtn} bg-surface2 text-fg/70`}>
                Eigentor Gegner
              </button>
              <button onClick={() => mark('timeout', 'us')} className={`${smallBtn} bg-surface2 text-fg/70`}>
                ⏱ Timeout{timeoutsUs > 0 ? ` (${timeoutsUs})` : ''}
              </button>
              <button onClick={() => mark('switch', 'us')} disabled={!isDouble} className={`${smallBtn} bg-surface2 text-fg/70`}>
                ⇄ Wechsel
              </button>
            </div>
          </div>

          {/* ── Gegner ───────────────────────────────────────────────────── */}
          <div className={sideBox}>
            <p className="text-fg/45 text-[11px] font-semibold tracking-wider uppercase mb-2">Gegner</p>
            <div className="grid grid-cols-2 gap-2">
              {opponents.map(slot => (
                <button
                  key={slot}
                  onClick={() => goal('them', undefined, undefined, slot)}
                  className={`${bigBtn} bg-surface2 border border-fg/15 ${opponents.length === 1 ? 'col-span-2 text-center' : ''}`}
                >
                  <p className={`font-semibold text-[15px] truncate ${opponentAt(gameIndex, slot) ? 'text-fg/85' : 'text-fg/55'}`}>
                    {opponentLabel(slot)}
                  </p>
                  <p className="text-fg/35 text-[11px] mt-0.5">Tor{isDouble ? ` · ${slot === 0 ? 'Sturm' : 'Tor'}` : ''}</p>
                </button>
              ))}
            </div>
            <div className="grid grid-cols-3 gap-2 mt-2">
              <button onClick={ownGoalByUs} className={`${smallBtn} bg-amber-900/30 border border-amber-500/30 text-amber-200/90`}>
                Eigentor von uns
              </button>
              <button onClick={() => mark('timeout', 'them')} className={`${smallBtn} bg-surface2 text-fg/70`}>
                ⏱ Timeout{timeoutsThem > 0 ? ` (${timeoutsThem})` : ''}
              </button>
              <button onClick={() => mark('switch', 'them')} disabled={!isDouble} className={`${smallBtn} bg-surface2 text-fg/70`}>
                ⇄ Wechsel
              </button>
            </div>
            {ownGoalOpen && positions.length > 1 && (
              <div className="flex gap-2 mt-2">
                {positions.map(p => (
                  <button
                    key={p.playerId}
                    onClick={() => goal('them', p.playerId, 'own_goal')}
                    className="flex-1 bg-amber-900/40 border border-amber-500/40 rounded-xl px-3 py-2.5 text-amber-200 text-[13px] font-semibold truncate"
                  >
                    {playerName(p.playerId)}
                  </button>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {canEdit && finished && !atEnd && (
        <button
          onClick={onNext}
          className="w-full rounded-2xl py-3.5 bg-surface border border-accent-cyan/40 text-accent-cyan text-[15px] font-bold active:opacity-70"
        >
          Weiter zum nächsten Satz ›
        </button>
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
                  {live.pendingIds.has(ev.id) && <span className="text-fg/25" title="noch nicht gespeichert">•</span>}
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
                placeholder={g.type === 'doubles' ? (slot === 0 ? 'Gegner:in Sturm' : 'Gegner:in Tor') : 'Gegner:in'}
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
  const duration = setDuration(score)
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
          <span className="text-fg/45 text-[11px]">
            {pf}:{pa} Punkte
            {/* Dauer gibt es nur, wo jemand „Go" gedrückt oder live getippt hat. */}
            {duration ? ` · ${formatDuration(duration)}` : ''}
          </span>
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
