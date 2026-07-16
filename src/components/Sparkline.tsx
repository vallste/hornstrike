type Accent = 'pink' | 'cyan' | 'gold'

const ACCENT_TEXT: Record<Accent, string> = {
  pink: 'text-accent-pink',
  cyan: 'text-accent-cyan',
  gold: 'text-accent-gold',
}

// Inline-SVG-Sparkline; stroke/fill = currentColor → erbt die (theme-abhängige)
// Akzentfarbe des Wrappers. Muster wie die currentColor-Icons in BottomNav.
export default function Sparkline({
  points, accent = 'cyan', height = 44,
}: {
  points: number[]
  accent?: Accent
  height?: number
}) {
  if (points.length === 0) return <div style={{ height }} />
  const w = 100
  const h = height
  const max = Math.max(1, ...points)
  const min = Math.min(0, ...points)
  const range = max - min || 1
  const step = points.length > 1 ? w / (points.length - 1) : 0
  const xy = points.map((p, i) => [i * step, h - ((p - min) / range) * h] as const)
  const line = xy.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ')
  const [lx, ly] = xy[xy.length - 1]
  return (
    <div className={ACCENT_TEXT[accent]}>
      <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="w-full" style={{ height }} aria-hidden="true">
        <polygon points={`0,${h} ${line} ${w},${h}`} fill="currentColor" fillOpacity={0.12} />
        <polyline
          points={line} fill="none" stroke="currentColor" strokeWidth={2}
          strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke"
        />
        <circle cx={lx} cy={ly} r={2.5} fill="currentColor" vectorEffect="non-scaling-stroke" />
      </svg>
    </div>
  )
}
