import { Link } from 'react-router-dom'

// Pflicht-Häkchen vor Login/Auth: Zustimmung zur Datenschutzerklärung.
export default function ConsentCheckbox({
  checked, onChange,
}: {
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <label className="flex items-start gap-2.5 text-left cursor-pointer select-none px-1">
      <input
        type="checkbox"
        checked={checked}
        onChange={e => onChange(e.target.checked)}
        className="mt-0.5 h-4 w-4 flex-shrink-0 accent-unicorn-pink"
      />
      <span className="text-fg/60 text-xs leading-snug">
        Ich habe die{' '}
        <Link to="/datenschutz" className="text-accent-pink underline">Datenschutzerklärung</Link>
        {' '}gelesen und stimme der Verarbeitung meiner Daten zu.
      </span>
    </label>
  )
}
