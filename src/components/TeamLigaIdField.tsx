import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { getSupabase } from '../lib/supabase'
import { errorMessage } from '../lib/errors'
import { ligaTeamUrl, parseLigaId } from '../lib/liga'

/**
 * Liga-ID des Teams pflegen (Tabelle & Ansetzungen beim Verband).
 *
 * Geschrieben wird über den RPC set_team_liga_id (0015): teams.* ist per
 * Tabellen-Policy nur für Vereins-Admins schreibbar, der RPC öffnet genau
 * dieses eine Feld für Captain und Co-Captain.
 */
export default function TeamLigaIdField({ teamId, ligaId }: { teamId: string; ligaId: number | null }) {
  const qc = useQueryClient()
  const [value, setValue] = useState(ligaId ? String(ligaId) : '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  const parsed = parseLigaId(value)
  const invalid = value.trim() !== '' && parsed === null
  const dirty = parsed !== (ligaId ?? null)

  const save = async () => {
    if (invalid || busy || !dirty) return
    setBusy(true)
    setError(null)
    const { error: rpcError } = await getSupabase().rpc('set_team_liga_id', { p_team: teamId, p_id: parsed })
    setBusy(false)
    if (rpcError) {
      setError(errorMessage(rpcError))
      return
    }
    setSaved(true)
    setTimeout(() => setSaved(false), 1500)
    void qc.invalidateQueries({ queryKey: ['workspaces'] })
    void qc.invalidateQueries({ queryKey: ['manage'] })
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <p className="text-fg/45 text-[12px] font-semibold tracking-widest uppercase">Liga-Team</p>
        {ligaId && (
          <a
            href={ligaTeamUrl(ligaId)}
            target="_blank"
            rel="noopener noreferrer"
            className="text-accent-cyan text-[13px] font-semibold"
          >
            Tabelle &amp; Ansetzungen ↗
          </a>
        )}
      </div>
      <div className="flex items-center gap-2">
        <input
          type="text"
          inputMode="numeric"
          value={value}
          onChange={e => setValue(e.target.value)}
          placeholder="Link der Teamseite einfügen oder ID"
          className="flex-1 min-w-0 bg-surface2 rounded-xl px-3 py-2 text-fg text-sm placeholder-fg/30 outline-none"
        />
        <button
          onClick={save}
          disabled={busy || invalid || !dirty}
          className="px-3 py-2 rounded-xl bg-surface2 text-fg text-[13px] font-semibold disabled:opacity-40 flex-shrink-0"
        >
          {busy ? '…' : saved ? '✓' : 'Speichern'}
        </button>
      </div>
      <p className={`text-[11px] mt-1.5 leading-snug ${invalid || error ? 'text-red-400' : 'text-fg/35'}`}>
        {error
          ? error
          : invalid
            ? 'Daraus lässt sich keine ID lesen – Link von kickern-hamburg.de einfügen oder die Zahl eintragen.'
            : 'Link von kickern-hamburg.de einfügen, die ID wird herausgelesen. Die App ruft dort nichts ab, sie verlinkt nur.'}
      </p>
    </div>
  )
}
