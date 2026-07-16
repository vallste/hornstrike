type Accent = 'pink' | 'cyan' | 'gold'

const ACCENT_FILL: Record<Accent, string> = {
  pink: 'bg-accent-pink',
  cyan: 'bg-accent-cyan',
  gold: 'bg-accent-gold',
}

// Funnel-Stufen: Balkenbreite relativ zur ersten Stufe, %-Angabe relativ zur
// jeweils vorigen Stufe.
export default function FunnelBar({
  stages, accent = 'gold',
}: {
  stages: { label: string; value: number }[]
  accent?: Accent
}) {
  const top = Math.max(1, stages[0]?.value ?? 1)
  return (
    <div className="space-y-2.5">
      {stages.map((s, i) => {
        const pctOfTop = (s.value / top) * 100
        const rel = i === 0 ? 100 : (stages[i - 1].value ? (s.value / stages[i - 1].value) * 100 : 0)
        return (
          <div key={s.label}>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-fg/60">{s.label}</span>
              <span className="text-fg font-semibold tabular-nums">
                {s.value}{i > 0 && <span className="text-fg/40"> · {Math.round(rel)}%</span>}
              </span>
            </div>
            <div className="h-3 rounded-full bg-surface2 overflow-hidden">
              <div className={`h-full rounded-full ${ACCENT_FILL[accent]}`} style={{ width: `${pctOfTop}%` }} />
            </div>
          </div>
        )
      })}
    </div>
  )
}
