import { usePreviewRole } from '../context/PreviewRoleProvider'
import { ROLE_LABEL } from '../lib/permissions'
import { usePlayers } from '../store'

/** Deutlicher Hinweis-Balken, solange der Admin-Vorschaumodus aktiv ist. */
export default function PreviewRoleBanner() {
  const { previewRole, previewPlayerId, setPreview } = usePreviewRole()
  const { players } = usePlayers()
  if (!previewRole) return null
  const who = previewPlayerId
    ? (players.find(p => p.id === previewPlayerId)?.name ?? 'Spieler')
    : ROLE_LABEL[previewRole]
  return (
    <div className="fixed top-0 inset-x-0 z-[60] bg-unicorn-gold text-[#1a0533] text-[13px] font-bold px-4 py-1.5 flex items-center justify-center gap-3 shadow-md">
      <span>👁 Vorschau als {who}</span>
      <button onClick={() => setPreview(null)} className="underline decoration-2 underline-offset-2">Beenden</button>
    </div>
  )
}
