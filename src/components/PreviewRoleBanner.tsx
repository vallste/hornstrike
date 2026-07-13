import { usePreviewRole } from '../context/PreviewRoleProvider'
import { ROLE_LABEL } from '../lib/permissions'

/** Deutlicher Hinweis-Balken, solange der Admin-Vorschaumodus aktiv ist. */
export default function PreviewRoleBanner() {
  const { previewRole, setPreviewRole } = usePreviewRole()
  if (!previewRole) return null
  return (
    <div className="fixed top-0 inset-x-0 z-[60] bg-unicorn-gold text-[#1a0533] text-[13px] font-bold px-4 py-1.5 flex items-center justify-center gap-3 shadow-md">
      <span>👁 Vorschau als {ROLE_LABEL[previewRole]}</span>
      <button onClick={() => setPreviewRole(null)} className="underline decoration-2 underline-offset-2">Beenden</button>
    </div>
  )
}
