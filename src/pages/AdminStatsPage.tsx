import { useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import Header from '../components/Header'
import LoadingScreen from '../components/LoadingScreen'
import ToggleGroup from '../components/ToggleGroup'
import Badge from '../components/Badge'
import StatTile from '../components/StatTile'
import BarChart from '../components/BarChart'
import Sparkline from '../components/Sparkline'
import FunnelBar from '../components/FunnelBar'
import { getSupabase } from '../lib/supabase'

// ── Typ des RPC-Ergebnisses (admin_usage_stats → jsonb) ──────────────────────
type Bucket = { bucket: string; count: number }
type Series = Record<'signups' | 'clubs' | 'teams' | 'matchdays' | 'polls', Bucket[]>
type AdminStats = {
  generated_at: string
  range: { from: string; to: string; days: number }
  adoption: {
    users_total: number; platform_admins: number; clubs_total: number; teams_total: number
    players_total: number; players_active: number; players_claimed: number; players_ghost: number
    memberships_by_role: Partial<Record<'club_admin' | 'team_admin' | 'player', number>>
    teams_per_club_avg: number; players_per_team_avg: number
  }
  growth: { weekly: Series; monthly: Series }
  activation: {
    invites: { created: number; accepted: number; revoked: number; expired: number; acceptance_rate: number; median_seconds_to_accept: number }
    club_requests: { pending: number; approved: number; rejected: number; approval_rate: number; median_seconds_to_review: number }
    account_adoption_ratio: number; users_with_membership_ratio: number
  }
  engagement: {
    matchdays_per_team_avg: number; polls_per_team_avg: number
    teams_active_30d: number; teams_dormant_30d: number; teams_active_60d: number; teams_dormant_60d: number
    polls_with_response_ratio: number
    response_status_mix: Partial<Record<'available' | 'maybe' | 'no', number>>
    goalie_usage_rate: number; fifth_double_usage_rate: number
  }
  login: {
    signups_total: number; active_1d: number; active_7d: number; active_30d: number
    never_signed_in: number; email_confirmed: number; email_confirmed_rate: number; _note: string
  }
  events: {
    counts_by_type: Record<string, number>
    per_day: { day: string; count: number }[]
    dau_series: { day: string; users: number }[]
    wau: number; mau: number
    top_screens: { path: string; count: number }[]
  }
  per_scope: { club_name: string; team_name: string; players: number; members: number; matchdays: number; polls: number; last_activity: string | null }[]
  health: {
    teams_without_players: number; clubs_without_teams: number; players_never_claimed: number
    polls_without_responses: number; club_requests_pending: number; club_requests_oldest_pending_seconds: number
    invites_pending: number; invites_expiring_7d: number; invites_expired: number
  }
  recent: Record<'signups' | 'matchdays' | 'polls' | 'club_requests', { at: string; label: string }[]>
}

type Range = '7d' | '30d' | 'all'

const pct = (x: number) => `${Math.round((x ?? 0) * 100)} %`
const dur = (s: number) => {
  if (!s || s <= 0) return '–'
  const d = Math.floor(s / 86400); if (d >= 1) return `${d} ${d === 1 ? 'Tag' : 'Tage'}`
  const h = Math.floor(s / 3600); if (h >= 1) return `${h} Std`
  return `${Math.max(1, Math.floor(s / 60))} Min`
}
const monthLabel = (iso: string) => new Date(iso).toLocaleDateString('de-DE', { month: 'short' })
const dateTime = (iso: string) => new Date(iso).toLocaleString('de-DE', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
const lastActivity = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('de-DE', { day: 'numeric', month: 'short', year: '2-digit' }) : '–')

const SectionCard = ({ title, children }: { title: string; children: ReactNode }) => (
  <div className="bg-surface rounded-2xl p-4">
    <p className="text-fg/45 text-[12px] font-semibold tracking-widest uppercase mb-3">{title}</p>
    {children}
  </div>
)

const PULSE_ICON: Record<string, string> = { signup: '👋', matchday: '⚽', poll: '📅', club_request: '🏛' }

export default function AdminStatsPage() {
  const navigate = useNavigate()
  const [range, setRange] = useState<Range>('7d')

  const { data, isLoading, error } = useQuery({
    queryKey: ['adminStats'],
    staleTime: 60_000,
    queryFn: async (): Promise<AdminStats> => {
      const { data, error } = await getSupabase().rpc('admin_usage_stats')
      if (error) throw error
      return data as AdminStats
    },
  })

  if (isLoading) return <LoadingScreen />
  if (error || !data) {
    return (
      <div className="min-h-screen bg-app flex items-center justify-center px-6">
        <div className="text-center">
          <p className="text-fg text-lg font-semibold">Statistiken konnten nicht geladen werden</p>
          {error && <p className="text-red-400/80 text-sm mt-2 break-words">{(error as Error).message}</p>}
          <button onClick={() => navigate('/settings')} className="text-accent-pink mt-4 block mx-auto">← Zurück</button>
        </div>
      </div>
    )
  }

  const { adoption: a, activation: act, engagement: eng, login, events, health: h } = data

  // Zeitraum-abhängig: „aktive" Nutzer + Sparkline-Fenster
  const activeCount = range === '7d' ? login.active_7d : range === '30d' ? login.active_30d : login.signups_total - login.never_signed_in
  const activeLabel = range === '7d' ? 'Aktiv 7 T' : range === '30d' ? 'Aktiv 30 T' : 'Aktiv gesamt'
  const perDay = events.per_day.map(d => d.count)
  const sparkPoints = range === '7d' ? perDay.slice(-7) : range === '30d' ? perDay.slice(-30) : perDay

  const bars = (arr: Bucket[]) => arr.map(b => ({ label: monthLabel(b.bucket), value: b.count }))
  const mix = eng.response_status_mix
  const mixData = [
    { label: 'Kann', value: mix.available ?? 0 },
    { label: 'Vielleicht', value: mix.maybe ?? 0 },
    { label: 'Nein', value: mix.no ?? 0 },
  ]

  // Puls: alle recent-Ströme mischen, nach Zeit absteigend
  const pulse = [
    ...data.recent.signups.map(r => ({ ...r, kind: 'signup', verb: 'Neuer Account' })),
    ...data.recent.matchdays.map(r => ({ ...r, kind: 'matchday', verb: 'Spieltag' })),
    ...data.recent.polls.map(r => ({ ...r, kind: 'poll', verb: 'Umfrage' })),
    ...data.recent.club_requests.map(r => ({ ...r, kind: 'club_request', verb: 'Vereins-Antrag' })),
  ].sort((x, y) => (x.at < y.at ? 1 : -1)).slice(0, 14)

  const healthChips: { label: string; warn: boolean }[] = [
    { label: `Teams ohne Spieler: ${h.teams_without_players}`, warn: h.teams_without_players > 0 },
    { label: `Vereine ohne Team: ${h.clubs_without_teams}`, warn: h.clubs_without_teams > 0 },
    { label: `Umfragen ohne Antwort: ${h.polls_without_responses}`, warn: h.polls_without_responses > 0 },
    { label: `Offene Anträge: ${h.club_requests_pending}${h.club_requests_pending ? ` (ältester ${dur(h.club_requests_oldest_pending_seconds)})` : ''}`, warn: h.club_requests_pending > 0 },
    { label: `Einladungen offen: ${h.invites_pending}`, warn: false },
    { label: `Läuft ab (7 T): ${h.invites_expiring_7d}`, warn: h.invites_expiring_7d > 0 },
    { label: `Abgelaufen: ${h.invites_expired}`, warn: h.invites_expired > 0 },
  ]

  return (
    <div className="min-h-screen bg-app pb-24">
      <div className="absolute w-[360px] h-[360px] rounded-full bg-unicorn-violet/35 blur-[140px] -top-20 right-0 pointer-events-none" />
      <Header title="Statistiken" back="/settings" />

      <div className="relative px-6 mt-2 space-y-5">
        <p className="text-fg/40 text-xs">
          Stand {dateTime(data.generated_at)} · Zeitraum letzte {data.range.days} Tage
        </p>

        <ToggleGroup<Range>
          value={range} onChange={setRange} accent="cyan"
          options={[{ value: '7d', label: '7 Tage' }, { value: '30d', label: '30 Tage' }, { value: 'all', label: 'Gesamt' }]}
        />

        {/* (a) KPIs */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <StatTile label="Nutzer" value={a.users_total} />
          <StatTile label={activeLabel} value={activeCount} accent="cyan" />
          <StatTile label="Vereine" value={a.clubs_total} />
          <StatTile label="Teams" value={a.teams_total} />
          <StatTile label="Spieler" value={a.players_total} hint={`${a.players_claimed} mit Account · ${a.players_ghost} ohne`} />
          <StatTile label="Plattform-Admins" value={a.platform_admins} />
        </div>

        {/* (b) Aktivität */}
        <SectionCard title="Aktivität">
          <div className="flex gap-6 mb-3">
            <div><p className="text-accent-cyan font-bold text-2xl tabular-nums">{events.dau_series[events.dau_series.length - 1]?.users ?? 0}</p><p className="text-fg/50 text-xs">DAU</p></div>
            <div><p className="text-fg font-bold text-2xl tabular-nums">{events.wau}</p><p className="text-fg/50 text-xs">WAU</p></div>
            <div><p className="text-fg font-bold text-2xl tabular-nums">{events.mau}</p><p className="text-fg/50 text-xs">MAU</p></div>
          </div>
          <Sparkline points={sparkPoints} accent="cyan" />
          <p className="text-fg/45 text-xs mt-1">Events / Tag ({range === 'all' ? 'gesamter Zeitraum' : range === '7d' ? 'letzte 7 Tage' : 'letzte 30 Tage'})</p>
          <div className="flex flex-wrap gap-1.5 mt-3">
            {Object.entries(events.counts_by_type).sort((x, y) => y[1] - x[1]).map(([t, n]) => (
              <Badge key={t} label={`${t}: ${n}`} color="default" />
            ))}
            {Object.keys(events.counts_by_type).length === 0 && <p className="text-fg/40 text-xs">Noch keine Events erfasst.</p>}
          </div>
        </SectionCard>

        {/* (c) Wachstum */}
        <SectionCard title="Wachstum (pro Monat)">
          <div className="space-y-4">
            <div><p className="text-fg/55 text-xs mb-1.5">Neue Nutzer</p><BarChart data={bars(data.growth.monthly.signups)} accent="cyan" /></div>
            <div><p className="text-fg/55 text-xs mb-1.5">Neue Teams</p><BarChart data={bars(data.growth.monthly.teams)} accent="gold" /></div>
            <div><p className="text-fg/55 text-xs mb-1.5">Neue Spieltage</p><BarChart data={bars(data.growth.monthly.matchdays)} accent="pink" /></div>
          </div>
        </SectionCard>

        {/* (d) Aktivierung */}
        <SectionCard title="Aktivierung">
          <div className="space-y-4">
            <div>
              <p className="text-fg/55 text-xs mb-1.5">Einladungen · Annahmerate {pct(act.invites.acceptance_rate)} · ⌀ {dur(act.invites.median_seconds_to_accept)}</p>
              <FunnelBar accent="gold" stages={[{ label: 'Eingeladen', value: act.invites.created }, { label: 'Angenommen', value: act.invites.accepted }]} />
            </div>
            <div>
              <p className="text-fg/55 text-xs mb-1.5">Vereins-Anträge · Genehmigungsrate {pct(act.club_requests.approval_rate)} · ⌀ {dur(act.club_requests.median_seconds_to_review)}</p>
              <FunnelBar accent="cyan" stages={[{ label: 'Gestellt', value: act.club_requests.pending + act.club_requests.approved + act.club_requests.rejected }, { label: 'Genehmigt', value: act.club_requests.approved }]} />
            </div>
            <div>
              <p className="text-fg/55 text-xs mb-1.5">Account-Adoption (Spieler mit Account)</p>
              <FunnelBar accent="pink" stages={[{ label: 'Spieler gesamt', value: a.players_total }, { label: 'Mit Account', value: a.players_claimed }]} />
            </div>
          </div>
        </SectionCard>

        {/* (e) Engagement */}
        <SectionCard title="Engagement">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
            <StatTile label="⌀ Spieltage/Team" value={eng.matchdays_per_team_avg} />
            <StatTile label="Antwortquote Umfragen" value={pct(eng.polls_with_response_ratio)} accent="cyan" />
            <StatTile label="Aktive Teams (30T)" value={eng.teams_active_30d} accent="gold" />
            <StatTile label="Ruhende Teams" value={eng.teams_dormant_30d} />
            <StatTile label="Goalie-Nutzung" value={pct(eng.goalie_usage_rate)} />
            <StatTile label="5.-Doppel-Nutzung" value={pct(eng.fifth_double_usage_rate)} />
          </div>
          <p className="text-fg/55 text-xs mb-1.5">Umfrage-Antworten</p>
          <BarChart data={mixData} accent="cyan" />
        </SectionCard>

        {/* (f) Pro Verein/Team */}
        <SectionCard title="Pro Verein / Team">
          <div className="overflow-x-auto -mx-1">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="text-fg/40 text-[11px] uppercase tracking-wider">
                  <th className="text-left font-semibold py-1.5 px-1">Verein / Team</th>
                  <th className="text-right font-semibold py-1.5 px-1">Sp.</th>
                  <th className="text-right font-semibold py-1.5 px-1">Std.</th>
                  <th className="text-right font-semibold py-1.5 px-1">Umfr.</th>
                  <th className="text-right font-semibold py-1.5 px-1 whitespace-nowrap">Zuletzt</th>
                </tr>
              </thead>
              <tbody>
                {data.per_scope.map((s, i) => (
                  <tr key={i} className="border-t border-fg/5">
                    <td className="py-2 px-1">
                      <span className="text-fg">{s.team_name}</span>
                      <span className="text-fg/40 text-xs block">{s.club_name}</span>
                    </td>
                    <td className="text-right tabular-nums text-fg/80 px-1">{s.players}</td>
                    <td className="text-right tabular-nums text-fg/80 px-1">{s.matchdays}</td>
                    <td className="text-right tabular-nums text-fg/80 px-1">{s.polls}</td>
                    <td className="text-right text-fg/55 text-xs whitespace-nowrap px-1">{lastActivity(s.last_activity)}</td>
                  </tr>
                ))}
                {data.per_scope.length === 0 && (
                  <tr><td colSpan={5} className="text-fg/40 text-xs py-3 px-1">Noch keine Teams.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </SectionCard>

        {/* (g) Health / Ops */}
        <SectionCard title="Health & Betrieb">
          <div className="flex flex-wrap gap-1.5">
            {healthChips.map(c => <Badge key={c.label} label={c.label} color={c.warn ? 'gold' : 'default'} />)}
          </div>
        </SectionCard>

        {/* (h) Letzte Aktivität */}
        <SectionCard title="Letzte Aktivität">
          {pulse.length === 0 ? (
            <p className="text-fg/40 text-xs">Noch keine Aktivität.</p>
          ) : (
            <div className="space-y-2">
              {pulse.map((p, i) => (
                <div key={i} className="flex items-center gap-3">
                  <span className="text-lg leading-none">{PULSE_ICON[p.kind]}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-fg/80 text-sm truncate">{p.verb} · {p.label}</p>
                  </div>
                  <span className="text-fg/40 text-xs whitespace-nowrap">{dateTime(p.at)}</span>
                </div>
              ))}
            </div>
          )}
        </SectionCard>

        <p className="text-fg/30 text-[11px] leading-relaxed">{login._note}</p>
      </div>
    </div>
  )
}
