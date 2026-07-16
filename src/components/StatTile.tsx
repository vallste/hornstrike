type Accent = 'fg' | 'pink' | 'cyan' | 'gold'

// Volle Literale (keine Interpolation) → Tailwind purged sie nicht weg.
const ACCENT_TEXT: Record<Accent, string> = {
  fg: 'text-fg',
  pink: 'text-accent-pink',
  cyan: 'text-accent-cyan',
  gold: 'text-accent-gold',
}

export default function StatTile({
  label, value, accent = 'fg', hint,
}: {
  label: string
  value: string | number
  accent?: Accent
  hint?: string
}) {
  return (
    <div className="bg-surface rounded-2xl px-4 py-3.5">
      <p className={`font-bold text-2xl tabular-nums ${ACCENT_TEXT[accent]}`}>{value}</p>
      <p className="text-fg/50 text-xs mt-0.5">{label}</p>
      {hint && <p className="text-fg/35 text-[11px] mt-1">{hint}</p>}
    </div>
  )
}
