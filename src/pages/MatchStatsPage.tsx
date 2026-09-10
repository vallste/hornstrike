import { useMemo, type ReactNode } from 'react'
import Header from '../components/Header'
import BottomNav from '../components/BottomNav'
import { usePlayers, useMatchDays } from '../store'
import { useTeamEvents } from '../store/live'
import {
  doublesPairStats, singlesPlayerStats, scorerStats, timeoutEffect, switchEffect,
  winRate, goalDiff, MIN_SAMPLE, type AfterEventStat, type Balance,
} from '../lib/matchStats'
import { matchTotals } from '../types'

// Auswertungen über alle erfassten Begegnungen.
//
// Grundhaltung: lieber wenige ehrliche Zahlen als viele suggestive. Neben jeder
// Quote steht, worauf sie beruht; unter MIN_SAMPLE Beobachtungen wird sie
// ausgegraut, weil sie dann nichts aussagt.

function Section({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <div className="bg-surface rounded-2xl overflow-hidden">
      <div className="px-4 py-3 border-b border-fg/5">
        <p className="text-fg/45 text-[12px] font-semibold tracking-widest uppercase">{title}</p>
        {hint && <p className="text-fg/35 text-[11px] mt-1 leading-snug">{hint}</p>}
      </div>
      {children}
    </div>
  )
}

function BalanceRow({ label, balance }: { label: string; balance: Balance }) {
  const rate = winRate(balance)
  const thin = balance.sets < MIN_SAMPLE
  const diff = goalDiff(balance)
  return (
    <div className="px-4 py-2.5 border-b border-fg/5 last:border-b-0 flex items-center gap-3">
      <div className="flex-1 min-w-0">
        <p className="text-fg text-[14px] font-medium truncate">{label}</p>
        <p className="text-fg/35 text-[11px] mt-0.5">
          {balance.sets} Sätze · {balance.won}S {balance.drawn}U {balance.lost}N
          {' · '}Tore {balance.goalsFor}:{balance.goalsAgainst} ({diff >= 0 ? '+' : ''}{diff})
        </p>
      </div>
      <span className={`text-[15px] font-bold tabular-nums flex-shrink-0 ${thin ? 'text-fg/25' : 'text-accent-cyan'}`}>
        {rate.toFixed(0)}%
      </span>
    </div>
  )
}

function AfterEventCard({ title, stat, hint }: { title: string; stat: AfterEventStat; hint: string }) {
  const decided = stat.nextUs + stat.nextThem
  const share = decided === 0 ? 0 : (100 * stat.nextUs) / decided
  const thin = decided < MIN_SAMPLE
  return (
    <div className="px-4 py-3 border-b border-fg/5 last:border-b-0">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-fg text-[14px] font-medium">{title}</p>
        <span className={`text-[18px] font-bold tabular-nums ${thin ? 'text-fg/25' : 'text-accent-cyan'}`}>
          {decided === 0 ? '–' : `${share.toFixed(0)}%`}
        </span>
      </div>
      <p className="text-fg/40 text-[11px] mt-1 leading-snug">
        {stat.count === 0
          ? 'Noch nichts erfasst.'
          : <>
              {stat.count}× erfasst · nächstes Tor {stat.nextUs} für uns, {stat.nextThem} für den Gegner
              {stat.nextNone > 0 ? `, ${stat.nextNone}× fiel keins mehr` : ''}
              {' · '}Rest des Satzes {stat.restFor}:{stat.restAgainst}
            </>}
      </p>
      {stat.count > 0 && thin && (
        <p className="text-fg/25 text-[11px] mt-1">{hint}</p>
      )}
    </div>
  )
}

export default function MatchStatsPage() {
  const { players } = usePlayers()
  const { matchDays } = useMatchDays()
  const { events, isLoading } = useTeamEvents()

  const playerName = (id: string) => players.find(p => p.id === id)?.name ?? 'Unbekannt'

  const played = useMemo(
    () => matchDays.filter(md => matchTotals(md.sets ?? [], md.useFifthDouble ?? false).setsFinished > 0),
    [matchDays],
  )

  const season = useMemo(() => {
    let pf = 0, pa = 0, gf = 0, ga = 0, won = 0, lost = 0, drawn = 0
    for (const md of played) {
      const t = matchTotals(md.sets ?? [], md.useFifthDouble ?? false)
      pf += t.pointsFor; pa += t.pointsAgainst
      gf += t.goalsFor; ga += t.goalsAgainst
      if (t.pointsFor > t.pointsAgainst) won += 1
      else if (t.pointsFor < t.pointsAgainst) lost += 1
      else drawn += 1
    }
    return { pf, pa, gf, ga, won, lost, drawn }
  }, [played])

  const pairs = useMemo(
    () => doublesPairStats(matchDays).sort((a, b) => winRate(b) - winRate(a) || goalDiff(b) - goalDiff(a)),
    [matchDays],
  )
  const singles = useMemo(
    () => singlesPlayerStats(matchDays).sort((a, b) => winRate(b) - winRate(a) || goalDiff(b) - goalDiff(a)),
    [matchDays],
  )
  const scorers = useMemo(() => scorerStats(events), [events])
  const toUs = useMemo(() => timeoutEffect(events, 'us'), [events])
  const toThem = useMemo(() => timeoutEffect(events, 'them'), [events])
  const switches = useMemo(() => switchEffect(events), [events])

  const hasDetail = events.length > 0

  return (
    <div className="min-h-screen bg-app pb-24">
      <div className="absolute w-[380px] h-[380px] rounded-full bg-unicorn-violet/35 blur-[140px] -top-20 right-0 pointer-events-none" />
      <Header title="Auswertungen" back="/matchday" />

      <div className="relative px-6 mt-4 space-y-3">
        {played.length === 0 ? (
          <div className="bg-surface rounded-2xl p-6 text-center">
            <p className="text-4xl mb-3">📊</p>
            <p className="text-fg font-semibold">Noch keine Ergebnisse</p>
            <p className="text-fg/45 text-sm mt-1">
              Trage bei einem Spieltag unter „Ergebnisse" die Satzstände ein – oder tippe live Tor für Tor mit.
              Schon mit reinen Endständen entstehen Doppel- und Einzelbilanzen.
            </p>
          </div>
        ) : (
          <>
            {/* Saison-Überblick */}
            <div className="bg-surface rounded-2xl px-4 py-4">
              <p className="text-fg/45 text-[12px] font-semibold tracking-widest uppercase mb-2">Bilanz</p>
              <div className="flex items-end justify-between">
                <div>
                  <p className="text-fg text-[26px] font-bold leading-none">{season.won}<span className="text-fg/30">–</span>{season.drawn}<span className="text-fg/30">–</span>{season.lost}</p>
                  <p className="text-fg/35 text-[11px] mt-1">Begegnungen S–U–N</p>
                </div>
                <div className="text-right">
                  <p className="text-fg/70 text-[16px] font-semibold leading-none">{season.pf} : {season.pa}</p>
                  <p className="text-fg/35 text-[11px] mt-1">Satzpunkte · Tore {season.gf}:{season.ga}</p>
                </div>
              </div>
            </div>

            {pairs.length > 0 && (
              <Section
                title="Doppel-Harmonie"
                hint="Satzquote jedes Duos, Unentschieden zählen halb. Braucht nur Satzstände."
              >
                {pairs.map(p => (
                  <BalanceRow
                    key={p.key}
                    label={p.playerIds.map(playerName).join(' + ')}
                    balance={p}
                  />
                ))}
              </Section>
            )}

            {singles.length > 0 && (
              <Section title="Einzel" hint="Satzquote im Einzel je Spieler.">
                {singles.map(p => (
                  <BalanceRow key={p.playerId} label={playerName(p.playerId)} balance={p} />
                ))}
              </Section>
            )}

            {hasDetail ? (
              <>
                {scorers.length > 0 && (
                  <Section title="Torschützen" hint="Aus dem Tor-für-Tor-Protokoll – nur wo live mitgetippt wurde.">
                    {scorers.map(s => (
                      <div key={s.playerId} className="px-4 py-2.5 border-b border-fg/5 last:border-b-0 flex items-center gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="text-fg text-[14px] font-medium truncate">{playerName(s.playerId)}</p>
                          <p className="text-fg/35 text-[11px] mt-0.5">
                            {s.attack} aus dem Sturm · {s.defense} aus dem Tor
                            {s.ownGoals > 0 ? ` · ${s.ownGoals} Eigentor${s.ownGoals > 1 ? 'e' : ''}` : ''}
                          </p>
                        </div>
                        <span className="text-accent-cyan text-[16px] font-bold tabular-nums flex-shrink-0">{s.goals}</span>
                      </div>
                    ))}
                  </Section>
                )}

                <Section
                  title="Timeouts & Wechsel"
                  hint="Anteil der Fälle, in denen das nächste Tor an uns ging. Kein Beweis für Ursache – aber ein Hinweis."
                >
                  <AfterEventCard
                    title="Nach eigenem Timeout"
                    stat={toUs}
                    hint={`Erst ab ${MIN_SAMPLE} Fällen aussagekräftig.`}
                  />
                  <AfterEventCard
                    title="Nach gegnerischem Timeout"
                    stat={toThem}
                    hint={`Erst ab ${MIN_SAMPLE} Fällen aussagekräftig.`}
                  />
                  <AfterEventCard
                    title="Nach Positionswechsel"
                    stat={switches}
                    hint={`Erst ab ${MIN_SAMPLE} Fällen aussagekräftig.`}
                  />
                </Section>
              </>
            ) : (
              <div className="bg-surface rounded-2xl px-4 py-4">
                <p className="text-fg/45 text-[12px] font-semibold tracking-widest uppercase mb-1.5">Noch mehr geht</p>
                <p className="text-fg/50 text-[13px] leading-snug">
                  Torschützen, Timeout-Wirkung und Positionswechsel entstehen erst, wenn bei einer Begegnung
                  live Tor für Tor mitgetippt wird. Die Bilanzen oben brauchen das nicht.
                </p>
              </div>
            )}

            {isLoading && <p className="text-fg/30 text-xs text-center">lädt Protokolle…</p>}
          </>
        )}
      </div>

      <BottomNav />
    </div>
  )
}
