const clamp = (m: number) => ((m % 1440) + 1440) % 1440
const toMins = (v: string) => { const [h, mm] = v.split(':').map(Number); return h * 60 + mm }
const fromMins = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`

/**
 * 24h-Zeit-Stepper (HH:MM). Unabhängig von Browser-/OS-Locale (kein AM/PM).
 * Wert ist '' oder 'HH:MM'. Erster Tap auf ± setzt 19:00, danach ±15 Min.
 */
export default function TimeField({ value, onChange, className, step = 15 }: {
  value: string
  onChange: (v: string) => void
  className?: string
  step?: number
}) {
  const shift = (d: number) => {
    const cur = value ? toMins(value) : 19 * 60 - d
    onChange(fromMins(clamp(cur + d)))
  }
  const btn = 'w-9 h-9 rounded-lg bg-surface2 text-fg text-xl flex items-center justify-center active:bg-fg/10 flex-shrink-0 select-none'
  return (
    <div className={`flex items-center justify-between gap-2 ${className ?? ''}`}>
      <button type="button" onClick={() => shift(-step)} className={btn} aria-label="früher">−</button>
      <span className="text-fg text-base font-semibold tabular-nums">
        {value || '—'} <span className="text-fg/40 text-xs font-normal">Uhr</span>
      </span>
      <button type="button" onClick={() => shift(step)} className={btn} aria-label="später">+</button>
    </div>
  )
}
