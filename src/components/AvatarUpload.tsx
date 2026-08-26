import { useRef } from 'react'
import Avatar from './Avatar'
import { useAvatarActions, useAvatarUrl, type AvatarKind } from '../lib/avatars'

/**
 * Bild-Auswahl mit Vorschau für Spieler/Team/Verein.
 *
 * `accept="image/*"` ist Absicht: iPhones liefern HEIC, und erst der
 * Client-Resize übersetzt das in WebP/JPEG – der Bucket lässt nur Raster-
 * Formate zu. Eine engere Allowlist würde iPhone-Fotos aus dem Dialog filtern.
 */
export default function AvatarUpload({
  kind, id, name, path, colorIndex = 0, shape = 'circle', label, hint,
  disabled = false, variant = 'card',
}: {
  kind: AvatarKind
  id: string
  name: string
  path?: string | null
  colorIndex?: number
  shape?: 'circle' | 'square'
  label: string
  hint?: string
  disabled?: boolean
  /** 'card' = eigene Karte (Editor-Seiten), 'inline' = in eine bestehende Karte eingebettet. */
  variant?: 'card' | 'inline'
}) {
  const fileRef = useRef<HTMLInputElement>(null)
  const url = useAvatarUrl(path)
  const { upload, remove, busy, error } = useAvatarActions()

  const pick = async (file: File | undefined) => {
    if (file) await upload(kind, id, file)
    if (fileRef.current) fileRef.current.value = ''   // gleiche Datei erneut wählbar
  }

  const inline = variant === 'inline'

  return (
    <div className={inline ? 'pt-1' : 'bg-surface rounded-2xl px-4 py-3.5'}>
      <p className={`text-fg/45 text-[12px] font-semibold tracking-widest uppercase ${inline ? 'mb-2' : 'mb-3'}`}>{label}</p>
      <div className={`flex items-center ${inline ? 'gap-3' : 'gap-4'}`}>
        <Avatar name={name} url={url} size={inline ? 44 : 64} colorIndex={colorIndex} shape={shape} />
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={disabled || busy}
              className="px-3 py-2 rounded-xl bg-surface2 text-fg text-[13px] font-semibold disabled:opacity-40"
            >
              {busy ? 'Lädt…' : (path ? 'Ändern' : 'Bild wählen')}
            </button>
            {path && (
              <button
                type="button"
                onClick={() => remove(kind, id)}
                disabled={disabled || busy}
                className="px-3 py-2 rounded-xl bg-fg/5 text-fg/60 text-[13px] font-semibold disabled:opacity-40"
              >
                Entfernen
              </button>
            )}
          </div>
          {hint && !error && <p className="text-fg/35 text-xs mt-2 leading-snug">{hint}</p>}
          {error && <p className="text-red-400 text-xs mt-2 leading-snug">{error}</p>}
        </div>
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={e => void pick(e.target.files?.[0])}
      />
    </div>
  )
}
