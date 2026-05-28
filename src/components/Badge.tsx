interface Props {
  label: string
  color?: 'pink' | 'cyan' | 'gold' | 'violet' | 'default'
}

const colorMap = {
  pink:   'bg-unicorn-pink/20 text-unicorn-pink',
  cyan:   'bg-unicorn-cyan/20 text-unicorn-cyan',
  gold:   'bg-unicorn-gold/20 text-unicorn-gold',
  violet: 'bg-unicorn-violet/30 text-white/70',
  default:'bg-white/10 text-white/60',
}

export default function Badge({ label, color = 'default' }: Props) {
  return (
    <span className={`text-[11px] font-medium px-2 py-0.5 rounded-md ${colorMap[color]}`}>
      {label}
    </span>
  )
}
