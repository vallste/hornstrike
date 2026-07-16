import { useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import Header from '../components/Header'
import LoadingScreen from '../components/LoadingScreen'
import Can from '../components/Can'
import { useCan, useMyPlayerId } from '../lib/permissions'
import { getSupabase } from '../lib/supabase'
import { errorMessage } from '../lib/errors'
import { useTrack } from '../lib/analytics'
import { usePlayers } from '../store'
import type { Player, Position, GameTypePreference } from '../types'
import { uuid } from '../utils/uuid'

function defaultPrefs(): Player['preferences'] {
  return { position: 'both', gameType: 'both', goaliePreference: false, avoidsOpening: false, avoidsClosing: false, partnerPreferences: [] }
}

// ── Preference Scale ──────────────────────────────────────────────────────────
// Visualisiert eine 5-stufige Skala (nur A | lieber A | beides | lieber B | nur B)

function PreferenceScale<T extends string>({
  label, leftLabel, rightLabel, options, value, onChange,
}: {
  label: string
  leftLabel: string
  rightLabel: string
  options: { value: T; label: string; short: string }[]
  value: T
  onChange: (v: T) => void
}) {
  const current = options.find(o => o.value === value)
  return (
    <div className="bg-surface rounded-2xl px-4 py-4">
      <div className="flex items-center justify-between mb-3">
        <p className="text-fg/45 text-[12px] font-semibold tracking-widest uppercase">{label}</p>
        <p className="text-accent-pink text-[12px] font-semibold">{current?.label}</p>
      </div>
      <div className="flex items-center gap-1 mb-2">
        {options.map(opt => (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            className={`flex-1 py-2.5 rounded-xl text-[11px] font-semibold transition-all ${
              value === opt.value
                ? 'bg-unicorn-pink text-white shadow-lg shadow-unicorn-pink/30'
                : 'bg-surface2 text-fg/40'
            }`}
          >
            {opt.short}
          </button>
        ))}
      </div>
      <div className="flex justify-between px-1">
        <span className="text-fg/25 text-[11px]">← {leftLabel}</span>
        <span className="text-fg/25 text-[11px]">{rightLabel} →</span>
      </div>
    </div>
  )
}

// ── Toggle Switch ─────────────────────────────────────────────────────────────

function ToggleSwitch({ label, description, value, onChange }: {
  label: string
  description?: string
  value: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <button
      onClick={() => onChange(!value)}
      className="w-full bg-surface rounded-2xl px-4 py-3.5 flex items-center justify-between"
    >
      <div className="text-left">
        <p className="text-fg font-semibold text-[15px]">{label}</p>
        {description && <p className="text-fg/40 text-xs mt-0.5">{description}</p>}
      </div>
      <div className={`w-12 h-6 rounded-full transition-colors relative flex-shrink-0 ${value ? 'bg-unicorn-cyan' : 'bg-surface2'}`}>
        <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-fg shadow transition-transform ${value ? 'translate-x-6' : 'translate-x-0.5'}`} />
      </div>
    </button>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

const POSITION_OPTIONS: { value: Position; label: string; short: string }[] = [
  { value: 'attack',            label: 'Immer Sturm',  short: 'Sturm!' },
  { value: 'attack_preferred',  label: 'Lieber Sturm', short: '> Sturm' },
  { value: 'both',              label: 'Egal',          short: 'Egal' },
  { value: 'defense_preferred', label: 'Lieber Tor',   short: 'Tor <' },
  { value: 'defense',           label: 'Immer Tor',    short: 'Tor!' },
]

const GAMETYPE_OPTIONS: { value: GameTypePreference; label: string; short: string }[] = [
  { value: 'singles_only',      label: 'Immer Einzel',  short: 'E!' },
  { value: 'singles_preferred', label: 'Lieber Einzel', short: '> E' },
  { value: 'both',              label: 'Egal',           short: 'Egal' },
  { value: 'doubles_preferred', label: 'Lieber Doppel', short: 'D <' },
  { value: 'doubles_only',      label: 'Immer Doppel',  short: 'D!' },
]

const AVATAR_COLORS = ['#00e5ff', '#e040fb', '#ffd700', '#00e5ff', '#7c3aed', '#e040fb', '#ffd700']

export default function PlayerEditorPage() {
  const { id } = useParams()
  const { players, isLoading } = usePlayers()
  const isNew = id === 'new'
  const existing = players.find(p => p.id === id)
  if (!isNew && isLoading) return <LoadingScreen />
  if (!isNew && !existing) return <Navigate to="/players" replace />
  return <PlayerEditorForm key={id ?? 'new'} />
}

function PlayerEditorForm() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { players, addPlayer, updatePlayer, deletePlayer } = usePlayers()
  const isNew = id === 'new'
  const existing = players.find(p => p.id === id)
  const canEditRoster = useCan('team:editRoster')
  const myPlayerId = useMyPlayerId()
  // Captain+ darf jeden bearbeiten; ein Spieler nur sein eigenes Profil.
  const editable = canEditRoster || (!!existing && existing.id === myPlayerId)

  const [name, setName] = useState(existing?.name ?? '')
  const [prefs, setPrefs] = useState(existing?.preferences ?? defaultPrefs())
  const [active, setActive] = useState(existing?.active !== false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [inviteLink, setInviteLink] = useState<string | null>(null)
  const [inviteBusy, setInviteBusy] = useState(false)
  const [inviteErr, setInviteErr] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const track = useTrack()

  const save = () => {
    if (!name.trim()) return
    if (isNew) {
      addPlayer({ id: uuid(), name: name.trim(), active: true, preferences: prefs })

    } else if (existing) {
      updatePlayer({ ...existing, name: name.trim(), active, preferences: prefs })
    }
    navigate('/players')
  }

  const generateInvite = async () => {
    if (!existing || inviteBusy) return
    setInviteBusy(true); setInviteErr(null)
    const { data, error } = await getSupabase().rpc('create_invite', { p_player: existing.id, p_role: 'player' })
    setInviteBusy(false)
    if (error) { setInviteErr(errorMessage(error)); return }
    setInviteLink(`${window.location.origin}${import.meta.env.BASE_URL}#/join/${data as string}`)
    track('invite_created', { source: 'player_editor' })
  }
  const copyLink = async () => {
    if (!inviteLink) return
    try { await navigator.clipboard.writeText(inviteLink); setCopied(true); setTimeout(() => setCopied(false), 1500) } catch { /* ignore */ }
  }
  const shareLink = async () => {
    if (!inviteLink) return
    if (navigator.share) { try { await navigator.share({ title: 'Hornstrike Einladung', url: inviteLink }) } catch { /* abgebrochen */ } }
    else copyLink()
  }

  const setPref = <K extends keyof Player['preferences']>(key: K, val: Player['preferences'][K]) =>
    setPrefs(p => ({ ...p, [key]: val }))

  const otherPlayers = players.filter(p =>
    p.id !== id && !prefs.partnerPreferences.find(pp => pp.playerId === p.id)
  )

  return (
    <div className="min-h-screen bg-app pb-32">
      <div className="absolute w-[360px] h-[360px] rounded-full bg-unicorn-violet/40 blur-[140px] top-0 right-0 pointer-events-none" />

      <Header title={isNew ? 'Neuer Spieler' : (existing?.name ?? 'Spieler')} back />

      <div className="relative px-6 mt-4">
        {!editable && (
          <p className="text-fg/50 text-xs bg-fg/5 rounded-xl px-3 py-2 mb-3">👁 Nur Ansicht – du kannst nur dein eigenes Profil bearbeiten.</p>
        )}
        <fieldset disabled={!editable} className="space-y-3 block min-w-0 border-0 p-0 m-0 disabled:opacity-60">

        {/* Name */}
        <div className="bg-surface rounded-2xl px-4 py-3.5">
          <p className="text-fg/45 text-[12px] font-semibold tracking-widest uppercase mb-1.5">Name</p>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Vollständiger Name"
            className="w-full bg-transparent text-fg placeholder-fg/25 text-[17px] font-semibold outline-none"
            autoFocus={isNew}
          />
        </div>

        {/* Position */}
        <PreferenceScale
          label="Bevorzugte Position"
          leftLabel="Immer Sturm"
          rightLabel="Immer Tor"
          options={POSITION_OPTIONS}
          value={prefs.position}
          onChange={v => setPref('position', v)}
        />

        {/* Spieltyp */}
        <PreferenceScale
          label="Bevorzugter Spieltyp"
          leftLabel="Immer Einzel"
          rightLabel="Immer Doppel"
          options={GAMETYPE_OPTIONS}
          value={prefs.gameType}
          onChange={v => setPref('gameType', v)}
        />

        {/* Goalie */}
        <ToggleSwitch
          label="🥅 Goalie"
          description="Spielt gerne Goalie"
          value={prefs.goaliePreference}
          onChange={v => setPref('goaliePreference', v)}
        />

        {/* Erstes / Letztes Spiel */}
        <div className="bg-surface rounded-2xl overflow-hidden">
          <div className="px-4 pt-4 pb-1">
            <p className="text-fg/45 text-[12px] font-semibold tracking-widest uppercase">Spielposition im Ablauf</p>
          </div>
          <div className="px-4 py-3 flex items-center justify-between border-t border-fg/5">
            <div>
              <p className="text-fg font-semibold text-[15px]">🚀 Kein Starter</p>
              <p className="text-fg/40 text-xs mt-0.5">Spielt ungern E1 oder E2</p>
            </div>
            <button onClick={() => setPref('avoidsOpening', !prefs.avoidsOpening)}
              className={`w-12 h-6 rounded-full transition-colors relative flex-shrink-0 ${prefs.avoidsOpening ? 'bg-unicorn-pink' : 'bg-surface2'}`}>
              <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-fg shadow transition-transform ${prefs.avoidsOpening ? 'translate-x-6' : 'translate-x-0.5'}`} />
            </button>
          </div>
          <div className="px-4 py-3 flex items-center justify-between border-t border-fg/5">
            <div>
              <p className="text-fg font-semibold text-[15px]">🏁 Kein Finisher</p>
              <p className="text-fg/40 text-xs mt-0.5">Spielt ungern die letzten Spiele</p>
            </div>
            <button onClick={() => setPref('avoidsClosing', !prefs.avoidsClosing)}
              className={`w-12 h-6 rounded-full transition-colors relative flex-shrink-0 ${prefs.avoidsClosing ? 'bg-unicorn-pink' : 'bg-surface2'}`}>
              <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-fg shadow transition-transform ${prefs.avoidsClosing ? 'translate-x-6' : 'translate-x-0.5'}`} />
            </button>
          </div>
        </div>

        {/* Partner preferences */}
        <div className="bg-surface rounded-2xl overflow-hidden">
          <div className="px-4 pt-4 pb-2 flex items-center justify-between">
            <p className="text-fg/45 text-[12px] font-semibold tracking-widest uppercase">Bevorzugte Partner</p>
            {prefs.partnerPreferences.length > 0 && (
              <p className="text-fg/30 text-[12px]">{prefs.partnerPreferences.length} ausgewählt</p>
            )}
          </div>

          {/* Existing partner preferences */}
          {prefs.partnerPreferences.map((pp, i) => {
            const partner = players.find(p => p.id === pp.playerId)
            const color = AVATAR_COLORS[players.findIndex(p => p.id === pp.playerId) % AVATAR_COLORS.length]
            return (
              <motion.div
                key={pp.playerId}
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="flex items-center px-4 py-2.5 border-t border-fg/5"
              >
                <div className="w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center text-[11px] font-bold mr-3"
                  style={{ background: `${color}22`, color }}>
                  {partner?.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                </div>
                <span className="flex-1 text-fg text-[14px] font-medium truncate">{partner?.name ?? '?'}</span>
                <div className="flex items-center gap-1.5 ml-2">
                  {[1, 2, 3].map(w => (
                    <button
                      key={w}
                      onClick={() => {
                        const updated = [...prefs.partnerPreferences]
                        updated[i] = { ...pp, weight: w as 1 | 2 | 3 }
                        setPref('partnerPreferences', updated)
                      }}
                      className={`text-[18px] leading-none ${pp.weight >= w ? 'text-accent-gold' : 'text-fg/15'}`}
                    >★</button>
                  ))}
                  <button
                    onClick={() => setPref('partnerPreferences', prefs.partnerPreferences.filter((_, j) => j !== i))}
                    className="ml-1 text-fg/20 text-sm w-6 h-6 flex items-center justify-center rounded-full hover:bg-fg/10"
                  >✕</button>
                </div>
              </motion.div>
            )
          })}

          {/* Add partner – tappable player list */}
          <AnimatePresence>
            {otherPlayers.length > 0 && (
              <div className="border-t border-fg/5 px-4 py-3">
                <p className="text-fg/30 text-[12px] mb-2.5">Tippen zum Hinzufügen:</p>
                <div className="flex flex-wrap gap-2">
                  {otherPlayers.map(p => {
                    const color = AVATAR_COLORS[players.findIndex(pl => pl.id === p.id) % AVATAR_COLORS.length]
                    return (
                      <button
                        key={p.id}
                        onClick={() => setPref('partnerPreferences', [
                          ...prefs.partnerPreferences,
                          { playerId: p.id, weight: 2 },
                        ])}
                        className="flex items-center gap-1.5 bg-surface2 rounded-full px-3 py-1.5 text-[13px] font-medium"
                        style={{ color }}
                      >
                        <span>{p.name.split(' ')[0]}</span>
                        <span className="text-fg/30 text-xs">+</span>
                      </button>
                    )
                  })}
                </div>
              </div>
            )}
          </AnimatePresence>

          {otherPlayers.length === 0 && prefs.partnerPreferences.length === 0 && (
            <p className="px-4 py-3 text-fg/25 text-[13px] border-t border-fg/5">
              {players.length <= 1 ? 'Erst weitere Spieler anlegen' : 'Alle Spieler bereits ausgewählt'}
            </p>
          )}
        </div>

        {/* Einladung (nur Captain+, bestehende Spieler) */}
        {!isNew && (
          <Can cap="team:invite">
            <div className="bg-surface rounded-2xl px-4 py-3.5">
              <p className="text-fg/45 text-[12px] font-semibold tracking-widest uppercase mb-2">Einladung</p>
              {!inviteLink ? (
                <button
                  onClick={generateInvite}
                  disabled={inviteBusy}
                  className="w-full py-2.5 rounded-xl bg-unicorn-cyan/15 text-accent-cyan text-sm font-semibold disabled:opacity-50"
                >{inviteBusy ? 'Erstelle…' : '🔗 Einladungslink erstellen'}</button>
              ) : (
                <div className="space-y-2">
                  <p className="text-fg/60 text-xs break-all bg-black/20 rounded-lg px-3 py-2">{inviteLink}</p>
                  <div className="flex gap-2">
                    <button onClick={copyLink} className="flex-1 py-2.5 rounded-xl bg-unicorn-violet text-white text-sm font-semibold">{copied ? 'Kopiert ✓' : 'Kopieren'}</button>
                    <button onClick={shareLink} className="flex-1 py-2.5 rounded-xl bg-unicorn-pink text-white text-sm font-semibold">Teilen</button>
                  </div>
                  <p className="text-fg/35 text-xs">Link an den Spieler schicken (z. B. WhatsApp). 30 Tage gültig, einmalig.</p>
                </div>
              )}
              {inviteErr && <p className="text-red-400 text-xs mt-2">{inviteErr}</p>}
            </div>
          </Can>
        )}

        {/* Inaktiv + Löschen (nur Captain+, bestehende Spieler) */}
        {!isNew && (
          <Can cap="team:editRoster">
          {/* Inaktiv-Toggle */}
          <button
            onClick={() => setActive(v => !v)}
            className="w-full bg-surface rounded-2xl px-4 py-3.5 flex items-center justify-between"
          >
            <div className="text-left">
              <p className="text-fg font-semibold text-[15px]">⏸ Inaktiv setzen</p>
              <p className="text-fg/40 text-xs mt-0.5">
                {active ? 'Spieler erscheint aktuell bei der Spieltag-Planung' : 'Spieler ist inaktiv und wird nicht angezeigt'}
              </p>
            </div>
            <div className={`w-12 h-6 rounded-full transition-colors relative flex-shrink-0 ${!active ? 'bg-amber-500' : 'bg-surface2'}`}>
              <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-fg shadow transition-transform ${!active ? 'translate-x-6' : 'translate-x-0.5'}`} />
            </div>
          </button>

          {/* Löschen */}
          {!confirmDelete ? (
            <button
              onClick={() => setConfirmDelete(true)}
              className="w-full bg-surface rounded-2xl px-4 py-3.5 flex items-center gap-3"
            >
              <span className="w-9 h-9 rounded-xl bg-red-500/15 flex items-center justify-center text-xl flex-shrink-0">🗑</span>
              <p className="text-red-400 font-semibold text-[15px]">Spieler löschen</p>
            </button>
          ) : (
            <div className="bg-red-900/30 border border-red-500/30 rounded-2xl px-4 py-4">
              <p className="text-red-300 font-semibold text-[14px] mb-1">Wirklich löschen?</p>
              <p className="text-red-200/60 text-xs mb-3">Diese Aktion kann nicht rückgängig gemacht werden.</p>
              <div className="flex gap-2">
                <button onClick={() => setConfirmDelete(false)} className="flex-1 py-2.5 rounded-xl bg-surface2 text-fg/60 text-sm font-semibold">Abbrechen</button>
                <button
                  onClick={() => { deletePlayer(existing!.id); navigate('/players') }}
                  className="flex-1 py-2.5 rounded-xl bg-red-600 text-white text-sm font-bold"
                >Ja, löschen</button>
              </div>
            </div>
          )}
          </Can>
        )}
        </fieldset>
      </div>

      {/* Save CTA */}
      {editable && (
        <div className="fixed bottom-0 left-0 right-0 px-6 pb-8 pt-4 bg-gradient-to-t from-app via-app/95 to-transparent">
          <button
            onClick={save}
            disabled={!name.trim()}
            className="w-full py-4 rounded-3xl bg-unicorn-pink text-white font-bold text-[17px] disabled:opacity-40 shadow-xl shadow-unicorn-pink/40"
          >
            {isNew ? 'Spieler anlegen' : 'Änderungen speichern'}
          </button>
        </div>
      )}
    </div>
  )
}
