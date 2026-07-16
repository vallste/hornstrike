type Accent = 'pink' | 'cyan' | 'gold'

const ACCENT_FILL: Record<Accent, string> = {
  pink: 'bg-accent-pink',
  cyan: 'bg-accent-cyan',
  gold: 'bg-accent-gold',
}

// Horizontale Balken aus Divs (Track = bg-surface2, Fill = accent). Theme-sicher.
export default function BarChart({
  data, accent = 'cyan',
}: {
  data: { label: string; value: number }[]
  accent?: Accent
}) {
  if (data.length === 0) return <p className="text-fg/40 text-xs">Keine Daten</p>
  const max = Math.max(1, ...data.map(d => d.value))
  return (
    <div className="space-y-2">
      {data.map((d, i) => (
        <div key={`${d.label}-${i}`} className="flex items-center gap-3">
          <span className="text-fg/55 text-xs w-20 shrink-0 truncate">{d.label}</span>
          <div className="flex-1 h-2.5 rounded-full bg-surface2 overflow-hidden">
            <div className={`h-full rounded-full ${ACCENT_FILL[accent]}`} style={{ width: `${(d.value / max) * 100}%` }} />
          </div>
          <span className="text-fg text-xs font-semibold tabular-nums w-8 text-right">{d.value}</span>
        </div>
      ))}
    </div>
  )
}
