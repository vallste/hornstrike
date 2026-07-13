import { createContext, useContext, useState, type ReactNode } from 'react'
import type { Role } from '../lib/permissions'

interface Ctx {
  previewRole: Role | null
  previewPlayerId: string | null   // bei „als Spieler": als welcher konkrete Spieler
  setPreview: (role: Role | null, playerId?: string | null) => void
}

const PreviewRoleContext = createContext<Ctx | null>(null)

/**
 * Admin-Vorschaumodus: überschreibt die UI-Rolle temporär (z. B. „als Spieler X
 * ansehen"). Nur clientseitig/UI – die serverseitigen Rechte (RLS) bleiben
 * unverändert. Bewusst NICHT persistiert (setzt sich bei Reload zurück).
 */
export function PreviewRoleProvider({ children }: { children: ReactNode }) {
  const [previewRole, setRole] = useState<Role | null>(null)
  const [previewPlayerId, setPlayerId] = useState<string | null>(null)
  const setPreview = (role: Role | null, playerId: string | null = null) => {
    setRole(role)
    setPlayerId(role ? playerId : null)
  }
  return (
    <PreviewRoleContext.Provider value={{ previewRole, previewPlayerId, setPreview }}>
      {children}
    </PreviewRoleContext.Provider>
  )
}

export function usePreviewRole() {
  const ctx = useContext(PreviewRoleContext)
  if (!ctx) throw new Error('usePreviewRole must be inside PreviewRoleProvider')
  return ctx
}
