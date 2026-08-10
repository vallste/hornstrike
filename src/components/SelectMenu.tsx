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
 *
 * variant='inline' → kompakt (z. B. Rollen-Dropdown in einer Zeile).
 * variant='block'  → volle Breite (z. B. Formularfeld im Sheet/in Einstellungen).
 *
 * Das Menü klappt automatisch nach oben, wenn nach unten kein Platz ist
 * (z. B. in einem Bottom-Sheet), und begrenzt seine Höhe auf den verfügbaren
 * Platz (scrollbar) – so läuft es nie aus dem Bildschirm.
 */
export default function SelectMenu<T extends string>({
  value, options, onChange, disabled = false, ariaLabel, variant = 'inline',
}: {
  value: T
  options: SelectOption<T>[]
  onChange: (v: T) => void
  disabled?: boolean
  ariaLabel?: string
  variant?: 'inline' | 'block'
}) {
  const [open, setOpen] = useState(false)
  const [placement, setPlacement] = useState<'top' | 'bottom'>('bottom')
  const [maxH, setMaxH] = useState<number | undefined>(undefined)
  const ref = useRef<HTMLDivElement>(null)
  const btnRef = useRef<HTMLButtonElement>(null)
  const current = options.find(o => o.value === value)
  const block = variant === 'block'

  useEffect(() => {
    if (!open) return
    const onDoc = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', onDoc)
    return () => document.removeEventListener('pointerdown', onDoc)
  }, [open])

  const toggle = () => {
    if (!open) {
      const r = btnRef.current?.getBoundingClientRect()
      if (r) {
        const below = window.innerHeight - r.bottom - 8
        const above = r.top - 8
        const useTop = below < 240 && above > below
        setPlacement(useTop ? 'top' : 'bottom')
        setMaxH(Math.min(320, Math.max(140, useTop ? above : below)))
      }
    }
    setOpen(o => !o)
  }

  const triggerCls = block
    ? 'w-full flex items-center justify-between gap-2 bg-surface2 text-fg text-[15px] rounded-xl px-4 py-3 outline-none disabled:opacity-50 active:opacity-70'
    : 'flex items-center gap-1 bg-surface2 text-accent-cyan text-xs font-semibold rounded-lg px-2.5 py-1.5 outline-none disabled:opacity-50 active:opacity-70'

  const posCls = placement === 'top' ? 'bottom-full mb-1' : 'top-full mt-1'
  const menuCls = block
    ? `absolute left-0 right-0 z-50 ${posCls} overflow-y-auto rounded-xl bg-surface border border-fg/10 shadow-xl`
    : `absolute right-0 z-50 ${posCls} min-w-[9rem] overflow-y-auto rounded-xl bg-surface border border-fg/10 shadow-xl`

  return (
    <div ref={ref} className={block ? 'relative w-full' : 'relative'}>
      <button
        ref={btnRef}
        type="button"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        disabled={disabled}
        onClick={toggle}
        className={triggerCls}
      >
        <span className={block ? 'truncate text-left' : ''}>{current?.label ?? '—'}</span>
        <svg viewBox="0 0 24 24" width={block ? 16 : 12} height={block ? 16 : 12} fill="none" stroke="currentColor"
          strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round"
          className={`flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''} ${block ? 'text-fg/40' : ''}`}>
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {open && (
        <div role="listbox" className={menuCls} style={{ maxHeight: maxH }}>
          {options.map(opt => (
            <button
              key={opt.value}
              type="button"
              role="option"
              aria-selected={opt.value === value}
              onClick={() => { onChange(opt.value); setOpen(false) }}
              className={`w-full text-left px-3.5 py-2.5 text-sm transition-colors active:bg-fg/10 ${
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
