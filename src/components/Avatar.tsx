import { useEffect, useState } from 'react'

/**
 * Profilbild mit Initialen-Fallback. Zeigt das Bild, sobald eine signierte URL
 * vorliegt – sonst (und bei abgelaufener URL) die Initialen in der Spielerfarbe.
 */

// Reihenfolge historisch gewachsen: ändert man sie, wechseln bestehende Spieler
// ihre Farbe. Bewusst mit Wiederholungen (7 Einträge, 5 Farben).
export const AVATAR_COLORS = ['#00e5ff', '#e040fb', '#ffd700', '#00e5ff', '#7c3aed', '#e040fb', '#ffd700']

export function avatarColor(index: number): string {
  const n = AVATAR_COLORS.length
  return AVATAR_COLORS[((index % n) + n) % n]
}

export function initialsOf(name: string): string {
  return name.trim().split(/\s+/).map(part => part[0] ?? '').join('').slice(0, 2).toUpperCase()
}

export default function Avatar({
  name, url, size = 40, colorIndex = 0, shape = 'circle', dimmed = false, className = '',
}: {
  name: string
  url?: string | null
  size?: number
  colorIndex?: number
  shape?: 'circle' | 'square'
  dimmed?: boolean
  className?: string
}) {
  // Läuft ein Token ab oder fehlt die Datei, fällt die Anzeige auf Initialen
  // zurück statt ein kaputtes Bild zu zeigen.
  const [failed, setFailed] = useState(false)
  useEffect(() => { setFailed(false) }, [url])

  const color = avatarColor(colorIndex)
  const showImage = !!url && !failed
  const initials = initialsOf(name)

  return (
    <div
      className={`flex-shrink-0 flex items-center justify-center overflow-hidden font-bold leading-none ${
        shape === 'circle' ? 'rounded-full' : 'rounded-xl'
      } ${dimmed ? 'opacity-35' : ''} ${className}`}
      style={{
        width: size,
        height: size,
        fontSize: Math.round(size * 0.33),
        background: showImage ? 'transparent' : `${color}22`,
        color,
      }}
    >
      {showImage ? (
        // alt="" ist Absicht: dekorativ, der Name steht in der UI direkt daneben.
        <img
          src={url as string}
          alt=""
          loading="lazy"
          decoding="async"
          onError={() => setFailed(true)}
          className="w-full h-full object-cover"
        />
      ) : (initials || '·')}
    </div>
  )
}
