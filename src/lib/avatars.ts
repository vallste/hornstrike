import { useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { getSupabase, isSupabaseConfigured } from './supabase'
import { errorMessage } from './errors'

// Profilbilder für Verein/Team/Spieler. Der Bucket ist PRIVAT (0013_avatars.sql):
// gelesen wird ausschließlich über kurzlebige signierte URLs, in der DB steht nur
// der Pfad. Alle Grenzwerte hier spiegeln die Bucket-Konfiguration – wer eine
// ändert, muss die andere mitziehen.

export type AvatarKind = 'players' | 'teams' | 'clubs'

const BUCKET = 'avatars'
/** Gültigkeit einer signierten URL. */
const SIGN_TTL_S = 60 * 60
/** Neu signieren, bevor die URL abläuft (react-query refetcht bei Fokus/Remount). */
const RESIGN_AFTER_MS = 45 * 60_000

/** Kantenlänge des gespeicherten Bildes – quadratisch, reicht für 3x-Displays. */
const OUTPUT_PX = 512
/** Reihenfolge = Präferenz. Beide Formate sind in allowed_mime_types erlaubt. */
const OUTPUT_CANDIDATES = ['image/webp', 'image/jpeg'] as const
const OUTPUT_QUALITY = 0.85
/** Spiegelt file_size_limit des Buckets (2 MB). */
export const MAX_UPLOAD_BYTES = 2 * 1024 * 1024
/** Grenze für die Eingabedatei – schützt das Decoding vor Monster-Dateien. */
const MAX_INPUT_BYTES = 25 * 1024 * 1024

/** Pfad-Konvention aus 0013_avatars.sql: 'kind/<uuid>', bewusst ohne Endung. */
export function avatarPath(kind: AvatarKind, id: string): string {
  return `${kind}/${id}`
}

// ── Bild aufbereiten (quadratisch, skaliert, erlaubtes Format) ───────────────

type Decoded = { src: CanvasImageSource; w: number; h: number; release: () => void }

async function decodeImage(file: File): Promise<Decoded> {
  // createImageBitmap dreht nach EXIF – ohne das landen iPhone-Hochformate gekippt.
  if (typeof createImageBitmap === 'function') {
    try {
      const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' })
      return { src: bmp, w: bmp.width, h: bmp.height, release: () => bmp.close() }
    } catch { /* älterer Browser / unbekanntes Format → <img>-Fallback */ }
  }
  const objectUrl = URL.createObjectURL(file)
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image()
      el.onload = () => resolve(el)
      el.onerror = () => reject(new Error('avatar: decode failed'))
      el.src = objectUrl
    })
    return { src: img, w: img.naturalWidth, h: img.naturalHeight, release: () => URL.revokeObjectURL(objectUrl) }
  } catch (e) {
    URL.revokeObjectURL(objectUrl)
    throw e
  }
}

const toBlob = (canvas: HTMLCanvasElement, type: string) =>
  new Promise<Blob | null>(resolve => canvas.toBlob(resolve, type, OUTPUT_QUALITY))

async function encodeCanvas(canvas: HTMLCanvasElement): Promise<{ blob: Blob; contentType: string }> {
  // Browser ohne WebP-Encoder fallen bei toBlob still auf PNG zurück – daran
  // erkennt man es (blob.type) und nimmt dann explizit JPEG, das viel kleiner ist.
  for (const type of OUTPUT_CANDIDATES) {
    const blob = await toBlob(canvas, type)
    if (blob && blob.type === type) return { blob, contentType: type }
  }
  const png = await toBlob(canvas, 'image/png')
  if (!png) throw new Error('avatar: encode failed')
  return { blob: png, contentType: png.type || 'image/png' }
}

/** Mittig quadratisch beschneiden, auf OUTPUT_PX skalieren, neu kodieren. */
export async function prepareAvatarImage(file: File): Promise<{ blob: Blob; contentType: string }> {
  if (!file.type.startsWith('image/')) throw new Error('avatar: not an image')
  if (file.size > MAX_INPUT_BYTES) throw new Error('avatar: input too large')

  const { src, w, h, release } = await decodeImage(file)
  try {
    if (!w || !h) throw new Error('avatar: decode failed')
    const side = Math.min(w, h)
    const canvas = document.createElement('canvas')
    canvas.width = OUTPUT_PX
    canvas.height = OUTPUT_PX
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('avatar: encode failed')
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(src, (w - side) / 2, (h - side) / 2, side, side, 0, 0, OUTPUT_PX, OUTPUT_PX)
    const out = await encodeCanvas(canvas)
    if (out.blob.size > MAX_UPLOAD_BYTES) throw new Error('avatar: output too large')
    return out
  } finally {
    release()
  }
}

// ── Lesen: signierte URLs ────────────────────────────────────────────────────

const NO_URLS: Record<string, string> = {}

// Beim Neu-Upload bleibt der Pfad gleich (Überschreiben), Browser und CDN
// könnten also das alte Bild weiterliefern. Jeder Schreibvorgang zählt diesen
// Zähler hoch; er geht als cacheNonce in die signierte URL ein und erzwingt
// damit ein frisches Bild. Reine Session-Größe – nach einem Reload sorgt schon
// das neue Token für eine andere URL.
let writeNonce = 0

/**
 * Signierte URLs für mehrere Pfade in EINEM Request. Für Listen immer diese
 * Variante auf Seitenebene nutzen – ein Hook pro Karte wären N Requests.
 */
export function useAvatarUrls(paths: (string | null | undefined)[]): Record<string, string> {
  // Stabiler Primitiv-Key: sonst neuer Query-Key bei jedem Render.
  const key = [...new Set(paths.filter((p): p is string => !!p))].sort().join('|')
  const wanted = useMemo(() => (key ? key.split('|') : []), [key])

  const { data } = useQuery({
    queryKey: ['avatarUrls', key],
    enabled: isSupabaseConfigured && wanted.length > 0,
    // Kürzer als SIGN_TTL_S – so liegt nie eine abgelaufene URL im Cache.
    staleTime: RESIGN_AFTER_MS,
    gcTime: RESIGN_AFTER_MS,
    // Hält Bilder auch in lange offenen Tabs am Leben (sonst 403 nach Ablauf).
    refetchInterval: RESIGN_AFTER_MS,
    queryFn: async (): Promise<Record<string, string>> => {
      const { data, error } = await getSupabase().storage.from(BUCKET).createSignedUrls(
        wanted, SIGN_TTL_S, writeNonce > 0 ? { cacheNonce: String(writeNonce) } : undefined,
      )
      if (error) throw error
      const map: Record<string, string> = {}
      for (const row of data ?? []) {
        if (row.path && row.signedUrl && !row.error) map[row.path] = row.signedUrl
      }
      return map
    },
  })

  return data ?? NO_URLS
}

export function useAvatarUrl(path: string | null | undefined): string | null {
  const urls = useAvatarUrls([path])
  return path ? urls[path] ?? null : null
}

// ── Schreiben: Upload / Entfernen ────────────────────────────────────────────

export function useAvatarActions() {
  const qc = useQueryClient()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const invalidate = (kind: AvatarKind) => {
    // Neuer Pfad ODER neues Bild am selben Pfad → neu signieren, mit frischem
    // Nonce, damit kein zwischengespeichertes Bild zurückkommt.
    writeNonce += 1
    void qc.invalidateQueries({ queryKey: ['avatarUrls'] })
    if (kind === 'players') {
      void qc.invalidateQueries({ queryKey: ['players'] })
    } else {
      void qc.invalidateQueries({ queryKey: ['manage'] })
      void qc.invalidateQueries({ queryKey: ['workspaces'] })
    }
  }

  /** Pfad in der DB verankern – je Entität über den erlaubten Weg. */
  const writePath = async (kind: AvatarKind, id: string, path: string | null) => {
    const sb = getSupabase()
    if (kind === 'teams') {
      // teams.avatar_path ist direkt nur für Vereins-Admins schreibbar. Der RPC
      // öffnet genau das Logo für Captains, ohne das Umbenennen-Recht.
      const { error } = await sb.rpc('set_team_avatar', { p_team: id, p_path: path })
      if (error) throw error
      return
    }
    const { error } = await sb.from(kind).update({ avatar_path: path }).eq('id', id)
    if (error) throw error
  }

  const upload = async (kind: AvatarKind, id: string, file: File): Promise<boolean> => {
    if (busy) return false
    setBusy(true)
    setError(null)
    try {
      const { blob, contentType } = await prepareAvatarImage(file)
      const path = avatarPath(kind, id)
      const up = await getSupabase().storage.from(BUCKET)
        .upload(path, blob, { upsert: true, contentType, cacheControl: '3600' })
      if (up.error) throw up.error
      await writePath(kind, id, path)
      return true
    } catch (e) {
      setError(errorMessage(e))
      return false
    } finally {
      setBusy(false)
      invalidate(kind)
    }
  }

  const remove = async (kind: AvatarKind, id: string): Promise<boolean> => {
    if (busy) return false
    setBusy(true)
    setError(null)
    try {
      // Erst die Referenz lösen, dann die Datei. Schlägt das Löschen fehl,
      // bleibt eine verwaiste Datei zurück – aber nie ein kaputtes Bild.
      await writePath(kind, id, null)
      const { error } = await getSupabase().storage.from(BUCKET).remove([avatarPath(kind, id)])
      if (error) throw error
      return true
    } catch (e) {
      setError(errorMessage(e))
      return false
    } finally {
      setBusy(false)
      invalidate(kind)
    }
  }

  return { upload, remove, busy, error }
}
