import { useEffect, useRef, useState } from 'react'

export interface SelectOption<T extends string> {
  value: T
  label: string
}

/**
 * Button-basiertes Dropdown (kein natives <select>). Native Selects öffnen auf
 * manchen mobilen Browsern nicht zuverlässig (Text wird markiert statt Menü) –
 * dieses Menü nutzt reine <button>-Taps und funktioniert dort verlässlich.
 * Rein clientseitig; theme-sicher über accent-/surface-Token.
 */
export default function SelectMenu<T extends string>({
  value, options, onChange, disabled = false, ariaLabel,
}: {
  value: T
  options: SelectOption<T>[]
  onChange: (v: T) => void
  disabled?: boolean
  ariaLabel?: string
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const current = options.find(o => o.value === value)

  useEffect(() => {
    if (!open) return
    const onDoc = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', onDoc)
    return () => document.removeEventListener('pointerdown', onDoc)
  }, [open])

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        disabled={disabled}
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1 bg-surface2 text-accent-cyan text-xs font-semibold rounded-lg px-2.5 py-1.5 outline-none disabled:opacity-50 active:opacity-70"
      >
        <span>{current?.label ?? '—'}</span>
        <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor"
          strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round"
          className={`transition-transform ${open ? 'rotate-180' : ''}`}>
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {open && (
        <div
          role="listbox"
          className="absolute right-0 z-50 mt-1 min-w-[9rem] rounded-xl bg-surface border border-fg/10 shadow-xl overflow-hidden"
        >
          {options.map(opt => (
            <button
              key={opt.value}
              type="button"
              role="option"
              aria-selected={opt.value === value}
              onClick={() => { onChange(opt.value); setOpen(false) }}
              className={`w-full text-left px-3 py-2.5 text-sm transition-colors active:bg-fg/10 ${
                opt.value === value ? 'text-accent-cyan font-semibold bg-fg/5' : 'text-fg/80'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
