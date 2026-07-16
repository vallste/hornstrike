import { useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Header from '../components/Header'
import BottomNav from '../components/BottomNav'
import { usePlayers, useMatchDays } from '../store'
import { exportBackup, parseBackup, CURRENT_VERSION, type BackupFile } from '../utils/backup'
import { useNavigate } from 'react-router-dom'
import { useSession } from '../context/SessionProvider'
import { useRole, useRealRole, can, ROLE_LABEL } from '../lib/permissions'
import { usePreviewRole } from '../context/PreviewRoleProvider'
import { useScope } from '../context/ScopeProvider'
import { useTheme, type Theme } from '../context/ThemeProvider'
import ToggleGroup from '../components/ToggleGroup'
import Can from '../components/Can'
import { resetOnboarding } from '../components/OnboardingGuide'
import { CHANGELOG } from '../data/changelog'
import { version as APP_VERSION } from '../../package.json'

export default function SettingsPage({ onStartTour }: { onStartTour?: () => void }) {
  const navigate = useNavigate()
  const { players, replaceAll: replacePlayers } = usePlayers()
  const { matchDays, replaceAll: replaceMatchDays } = useMatchDays()
  const fileRef = useRef<HTMLInputElement>(null)
  const { user, signOut } = useSession()
  const role = useRole()
  const realRole = useRealRole()
  const { previewRole, previewPlayerId, setPreview } = usePreviewRole()
  const { workspaces, currentTeamId, setCurrentTeam } = useScope()
  const { theme, setTheme } = useTheme()

  const handleLogout = async () => {
    await signOut()
    navigate('/login', { replace: true })
  }

  const [importPreview, setImportPreview] = useState<BackupFile | null>(null)
  const [importError, setImportError] = useState<string | null>(null)
  const [importMigratedFrom, setImportMigratedFrom] = useState<number | undefined>()
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 2500)
  }

  const handleExport = () => {
    exportBackup(players, matchDays)
    showToast('Backup heruntergeladen ✓')
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => {
      const result = parseBackup(ev.target?.result as string)
      if (!result.ok) {
        setImportError(result.error ?? 'Unbekannter Fehler')
        setImportPreview(null)
      } else {
        setImportError(null)
        setImportPreview(result.data!)
        setImportMigratedFrom(result.migratedFrom)
      }
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  const confirmImport = () => {
    if (!importPreview) return
    replacePlayers(importPreview.players)
    replaceMatchDays(importPreview.matchDays)
    setImportPreview(null)
    showToast(`${importPreview.players.length} Spieler + ${importPreview.matchDays.length} Spieltage importiert ✓`)
  }

  const handleDeleteAll = () => {
    replacePlayers([])
    replaceMatchDays([])
    setShowDeleteConfirm(false)
    showToast('Alle Daten gelöscht')
  }

  return (
    <div className="min-h-screen bg-app pb-24">
      <div className="absolute w-[360px] h-[360px] rounded-full bg-unicorn-violet/35 blur-[140px] -top-20 right-0 pointer-events-none" />

      <Header title="Einstellungen" />

      <div className="relative px-6 space-y-3 mt-4">

        {/* App info */}
        <div className="bg-surface rounded-2xl px-4 py-4 flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-unicorn-violet/50 flex items-center justify-center text-2xl">🦄</div>
          <div>
            <p className="text-fg font-bold text-[16px]">Hornstrike</p>
            <p className="text-fg/45 text-xs mt-0.5">Fellow Unicorns · Hamburger Liga</p>
            <p className="text-fg/30 text-xs mt-0.5">v{APP_VERSION} · Datenformat v{CURRENT_VERSION}</p>
          </div>
        </div>

        {/* Account */}
        <div className="bg-surface rounded-2xl overflow-hidden">
          <div className="px-4 py-3 border-b border-fg/5">
            <p className="text-fg/45 text-[12px] font-semibold tracking-widest uppercase">Account</p>
          </div>
          <div className="px-4 py-3.5">
            <p className="text-fg font-semibold text-[15px] break-all">{user?.email ?? '—'}</p>
            <p className="text-fg/45 text-xs mt-0.5">Rolle: {role ? ROLE_LABEL[role] : '—'}</p>
          </div>
          {can(realRole, 'team:editRoster') && (
            <div className="px-4 pb-3">
              <p className="text-fg/45 text-xs mb-1.5">Vorschau (nur Ansicht)</p>
              <select
                value={previewRole === 'player' && previewPlayerId ? previewPlayerId : ''}
                onChange={e => (e.target.value ? setPreview('player', e.target.value) : setPreview(null))}
                className="w-full rounded-xl bg-surface2 text-fg text-sm px-3 py-2.5 outline-none"
              >
                <option value="">Normal (als du)</option>
                {players.map(p => (
                  <option key={p.id} value={p.id}>Als Spieler: {p.name}</option>
                ))}
              </select>
            </div>
          )}
          <div className="h-px bg-fg/5" />
          <button onClick={handleLogout} className="w-full flex items-center gap-3 px-4 py-4 active:bg-fg/5 transition-colors">
            <span className="w-9 h-9 rounded-xl bg-red-500/10 flex items-center justify-center text-xl">🚪</span>
            <div className="flex-1 text-left">
              <p className="text-fg font-semibold text-[15px]">Abmelden</p>
              <p className="text-fg/40 text-xs mt-0.5">Von diesem Gerät ausloggen</p>
            </div>
            <span className="text-fg/25 text-lg">›</span>
          </button>
        </div>

        {/* Darstellung */}
        <div className="bg-surface rounded-2xl px-4 py-3.5">
          <p className="text-fg/45 text-[12px] font-semibold tracking-widest uppercase mb-2.5">Darstellung</p>
          <ToggleGroup<Theme>
            value={theme}
            onChange={setTheme}
            options={[
              { value: 'light', label: '☀️ Hell' },
              { value: 'system', label: 'Auto' },
              { value: 'dark', label: '🌙 Dunkel' },
            ]}
          />
        </div>

        {/* Verein */}
        <div className="bg-surface rounded-2xl overflow-hidden">
          <div className="px-4 py-3 border-b border-fg/5">
            <p className="text-fg/45 text-[12px] font-semibold tracking-widest uppercase">Verein</p>
          </div>
          {workspaces.length > 1 && (
            <div className="px-4 py-3 border-b border-fg/5">
              <p className="text-fg/45 text-xs mb-1.5">Aktueller Workspace</p>
              <select
                value={currentTeamId ?? ''}
                onChange={e => setCurrentTeam(e.target.value)}
                className="w-full rounded-xl bg-surface2 text-fg text-sm px-3 py-2.5 outline-none"
              >
                {workspaces.map(w => (
                  <option key={w.teamId} value={w.teamId}>{w.clubName} · {w.teamName}</option>
                ))}
              </select>
            </div>
          )}
          <Can cap="team:invite">
            <button onClick={() => navigate('/members')} className="w-full flex items-center gap-3 px-4 py-4 active:bg-fg/5 transition-colors border-b border-fg/5">
              <span className="w-9 h-9 rounded-xl bg-unicorn-pink/15 flex items-center justify-center text-xl">👥</span>
              <div className="flex-1 text-left">
                <p className="text-fg font-semibold text-[15px]">Mitglieder &amp; Einladungen</p>
                <p className="text-fg/40 text-xs mt-0.5">Accounts, Rollen, Einladungslinks</p>
              </div>
              <span className="text-fg/25 text-lg">›</span>
            </button>
          </Can>
          <button onClick={() => navigate('/request-club')} className="w-full flex items-center gap-3 px-4 py-4 active:bg-fg/5 transition-colors">
            <span className="w-9 h-9 rounded-xl bg-unicorn-violet/40 flex items-center justify-center text-xl">➕</span>
            <div className="flex-1 text-left">
              <p className="text-fg font-semibold text-[15px]">Neuen Verein beantragen</p>
              <p className="text-fg/40 text-xs mt-0.5">Antrag zur Freigabe durch einen Plattform-Admin</p>
            </div>
            <span className="text-fg/25 text-lg">›</span>
          </button>
        </div>

        {/* Plattform-Admin */}
        <Can cap="app:viewStats">
          <div className="bg-surface rounded-2xl overflow-hidden">
            <div className="px-4 py-3 border-b border-fg/5">
              <p className="text-fg/45 text-[12px] font-semibold tracking-widest uppercase">Plattform-Admin</p>
            </div>
            <button onClick={() => navigate('/admin/stats')} className="w-full flex items-center gap-3 px-4 py-4 active:bg-fg/5 transition-colors border-b border-fg/5">
              <span className="w-9 h-9 rounded-xl bg-unicorn-cyan/15 flex items-center justify-center text-xl">📊</span>
              <div className="flex-1 text-left">
                <p className="text-fg font-semibold text-[15px]">Statistiken</p>
                <p className="text-fg/40 text-xs mt-0.5">Plattform-Nutzung: Wachstum, Aktivität, Engagement</p>
              </div>
              <span className="text-fg/25 text-lg">›</span>
            </button>
            <button onClick={() => navigate('/admin/club-requests')} className="w-full flex items-center gap-3 px-4 py-4 active:bg-fg/5 transition-colors">
              <span className="w-9 h-9 rounded-xl bg-unicorn-gold/15 flex items-center justify-center text-xl">🗂</span>
              <div className="flex-1 text-left">
                <p className="text-fg font-semibold text-[15px]">Vereins-Anträge</p>
                <p className="text-fg/40 text-xs mt-0.5">Offene Anträge prüfen &amp; freigeben</p>
              </div>
              <span className="text-fg/25 text-lg">›</span>
            </button>
          </div>
        </Can>

        {/* Current data overview */}
        <div className="bg-surface rounded-2xl px-4 py-3.5">
          <p className="text-fg/45 text-[12px] font-semibold tracking-widest uppercase mb-2">Aktueller Datenbestand</p>
          <div className="flex gap-6">
            <div>
              <p className="text-fg font-bold text-2xl">{players.length}</p>
              <p className="text-fg/50 text-xs">Spieler</p>
            </div>
            <div>
              <p className="text-fg font-bold text-2xl">{matchDays.length}</p>
              <p className="text-fg/50 text-xs">Spieltage</p>
            </div>
          </div>
        </div>

        {/* Export */}
        <div className="bg-surface rounded-2xl overflow-hidden">
          <div className="px-4 py-3 border-b border-fg/5">
            <p className="text-fg/45 text-[12px] font-semibold tracking-widest uppercase">Datensicherung</p>
          </div>
          <button
            onClick={handleExport}
            className="w-full flex items-center gap-3 px-4 py-4 active:bg-fg/5 transition-colors"
          >
            <span className="w-9 h-9 rounded-xl bg-unicorn-cyan/15 flex items-center justify-center text-xl">📤</span>
            <div className="flex-1 text-left">
              <p className="text-fg font-semibold text-[15px]">Exportieren</p>
              <p className="text-fg/40 text-xs mt-0.5">Alle Spieler + Spieltage als JSON-Datei</p>
            </div>
            <span className="text-fg/25 text-lg">›</span>
          </button>

          <Can cap="team:editRoster">
            <div className="h-px bg-fg/5" />

            <button
              onClick={() => fileRef.current?.click()}
              className="w-full flex items-center gap-3 px-4 py-4 active:bg-fg/5 transition-colors"
            >
              <span className="w-9 h-9 rounded-xl bg-unicorn-pink/15 flex items-center justify-center text-xl">📥</span>
              <div className="flex-1 text-left">
                <p className="text-fg font-semibold text-[15px]">Importieren</p>
                <p className="text-fg/40 text-xs mt-0.5">Backup-JSON einlesen (ersetzt bestehende Daten)</p>
              </div>
              <span className="text-fg/25 text-lg">›</span>
            </button>
            <input ref={fileRef} type="file" accept=".json,application/json" className="hidden" onChange={handleFileChange} />
          </Can>
        </div>

        {/* Import error */}
        {importError && (
          <div className="bg-red-900/40 border border-red-500/40 rounded-2xl px-4 py-3">
            <p className="text-red-300 text-[13px] font-semibold">Import fehlgeschlagen</p>
            <p className="text-red-200/70 text-[13px] mt-1">{importError}</p>
            <button onClick={() => setImportError(null)} className="text-red-300/60 text-xs mt-2 underline">Schließen</button>
          </div>
        )}

        {/* Import preview / confirm */}
        {importPreview && (
          <div className="bg-surface border border-accent-cyan/30 rounded-2xl px-4 py-4">
            <p className="text-accent-cyan font-semibold text-[15px] mb-1">Backup bereit zum Importieren</p>
            {importMigratedFrom !== undefined && (
              <p className="text-accent-gold text-[12px] mb-2">
                ⚠ Datei war v{importMigratedFrom} → automatisch auf v{CURRENT_VERSION} migriert
              </p>
            )}
            <p className="text-fg/60 text-[13px]">
              {importPreview.players.length} Spieler · {importPreview.matchDays.length} Spieltage
            </p>
            <p className="text-fg/40 text-xs mt-1">
              Exportiert: {new Date(importPreview.exportedAt).toLocaleString('de-DE')}
            </p>
            <p className="text-amber-300/80 text-xs mt-2">⚠ Bestehende Daten werden vollständig ersetzt.</p>
            <div className="flex gap-2 mt-4">
              <button
                onClick={() => setImportPreview(null)}
                className="flex-1 py-2.5 rounded-xl bg-surface2 text-fg/60 text-sm font-semibold"
              >
                Abbrechen
              </button>
              <button
                onClick={confirmImport}
                className="flex-1 py-2.5 rounded-xl bg-unicorn-cyan text-[#1a0533] text-sm font-bold"
              >
                Jetzt importieren
              </button>
            </div>
          </div>
        )}

        {/* Changelog + Tour */}
        <div className="bg-surface rounded-2xl overflow-hidden">
          <div className="px-4 py-3 border-b border-fg/5">
            <p className="text-fg/45 text-[12px] font-semibold tracking-widest uppercase">Info</p>
          </div>
          <button
            onClick={() => navigate('/changelog')}
            className="w-full flex items-center gap-3 px-4 py-4 active:bg-fg/5 transition-colors"
          >
            <span className="w-9 h-9 rounded-xl bg-unicorn-violet/40 flex items-center justify-center text-xl">📋</span>
            <div className="flex-1 text-left">
              <p className="text-fg font-semibold text-[15px]">Changelog</p>
              <p className="text-fg/40 text-xs mt-0.5">v{APP_VERSION} · {CHANGELOG[0]?.changes.length} neue Einträge</p>
            </div>
            <span className="text-fg/25 text-lg">›</span>
          </button>
          <div className="h-px bg-fg/5" />
          <button
            onClick={async () => {
              if ('serviceWorker' in navigator) {
                const regs = await navigator.serviceWorker.getRegistrations()
                for (const reg of regs) {
                  // Wartenden SW aktivieren (skip waiting)
                  if (reg.waiting) reg.waiting.postMessage({ type: 'SKIP_WAITING' })
                  // Auf neue Version prüfen
                  await reg.update().catch(() => {})
                }
              }
              window.location.reload()
            }}
            className="w-full flex items-center gap-3 px-4 py-4 active:bg-fg/5 transition-colors"
          >
            <span className="w-9 h-9 rounded-xl bg-unicorn-cyan/15 flex items-center justify-center text-xl">⟳</span>
            <div className="flex-1 text-left">
              <p className="text-fg font-semibold text-[15px]">App neu laden</p>
              <p className="text-fg/40 text-xs mt-0.5">Auf neue Version prüfen und neu starten</p>
            </div>
          </button>
          <div className="h-px bg-fg/5" />
          <button
            onClick={() => { resetOnboarding(); onStartTour?.() }}
            className="w-full flex items-center gap-3 px-4 py-4 active:bg-fg/5 transition-colors"
          >
            <span className="w-9 h-9 rounded-xl bg-unicorn-pink/15 flex items-center justify-center text-xl">🦄</span>
            <div className="flex-1 text-left">
              <p className="text-fg font-semibold text-[15px]">Tour neu starten</p>
              <p className="text-fg/40 text-xs mt-0.5">Einführung durch alle Funktionen</p>
            </div>
            <span className="text-fg/25 text-lg">›</span>
          </button>
        </div>

        {/* Danger zone – nur Captain+ */}
        <Can cap="team:editRoster">
        <div className="bg-surface rounded-2xl overflow-hidden">
          <div className="px-4 py-3 border-b border-fg/5">
            <p className="text-fg/45 text-[12px] font-semibold tracking-widest uppercase">Gefahrenzone</p>
          </div>
          {!showDeleteConfirm ? (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="w-full flex items-center gap-3 px-4 py-4 active:bg-fg/5"
            >
              <span className="w-9 h-9 rounded-xl bg-red-500/15 flex items-center justify-center text-xl">🗑</span>
              <div className="flex-1 text-left">
                <p className="text-red-400 font-semibold text-[15px]">Alle Daten löschen</p>
                <p className="text-fg/40 text-xs mt-0.5">Spieler und Spieltage unwiderruflich entfernen</p>
              </div>
            </button>
          ) : (
            <div className="px-4 py-4 bg-red-900/20">
              <p className="text-red-300 font-semibold text-[14px] mb-1">Wirklich alle Daten löschen?</p>
              <p className="text-red-200/60 text-xs mb-3">Diese Aktion kann nicht rückgängig gemacht werden.</p>
              <div className="flex gap-2">
                <button onClick={() => setShowDeleteConfirm(false)} className="flex-1 py-2.5 rounded-xl bg-surface2 text-fg/60 text-sm font-semibold">Abbrechen</button>
                <button onClick={handleDeleteAll} className="flex-1 py-2.5 rounded-xl bg-red-600 text-white text-sm font-bold">Ja, löschen</button>
              </div>
            </div>
          )}
        </div>
        </Can>
      </div>

      <BottomNav />

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 24 }}
            className="fixed bottom-8 left-4 right-4 z-50 bg-surface border border-fg/10 rounded-2xl px-4 py-3 text-center"
          >
            <p className="text-fg font-semibold text-[14px]">{toast}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
