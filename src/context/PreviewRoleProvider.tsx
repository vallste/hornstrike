import { createContext, useContext, useState, type ReactNode } from 'react'
import type { Role } from '../lib/permissions'

interface Ctx {
  previewRole: Role | null
  setPreviewRole: (r: Role | null) => void
}

const PreviewRoleContext = createContext<Ctx | null>(null)

/**
 * Admin-Vorschaumodus: überschreibt die UI-Rolle temporär (z. B. „als Spieler
 * ansehen"). Nur clientseitig/UI – die serverseitigen Rechte (RLS) bleiben
 * unverändert. Bewusst NICHT persistiert (setzt sich bei Reload zurück).
 */
export function PreviewRoleProvider({ children }: { children: ReactNode }) {
  const [previewRole, setPreviewRole] = useState<Role | null>(null)
  return (
    <PreviewRoleContext.Provider value={{ previewRole, setPreviewRole }}>
      {children}
    </PreviewRoleContext.Provider>
  )
}

export function usePreviewRole() {
  const ctx = useContext(PreviewRoleContext)
  if (!ctx) throw new Error('usePreviewRole must be inside PreviewRoleProvider')
  return ctx
}
