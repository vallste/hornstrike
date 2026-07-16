interface Option<T extends string> {
  value: T
  label: string
}

interface Props<T extends string> {
  options: Option<T>[]
  value: T
  onChange: (v: T) => void
  accent?: 'pink' | 'cyan'
}

export default function ToggleGroup<T extends string>({ options, value, onChange, accent = 'pink' }: Props<T>) {
  const activeClass = accent === 'cyan'
    ? 'bg-unicorn-cyan text-[#1a0533] font-bold'
    : 'bg-unicorn-pink text-white font-bold'

  return (
    <div className="flex gap-2">
      {options.map(opt => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all ${
            value === opt.value ? activeClass : 'bg-surface2 text-fg/55'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}
