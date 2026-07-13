import type { ReactNode } from 'react'
import { useCan, type Capability } from '../lib/permissions'

/**
 * Rendert `children` nur, wenn die aktuelle Rolle die Capability hat, sonst `fallback`.
 * Reine UI-Steuerung – die Durchsetzung passiert serverseitig via RLS.
 */
export default function Can({ cap, children, fallback = null }: {
  cap: Capability
  children: ReactNode
  fallback?: ReactNode
}) {
  return <>{useCan(cap) ? children : fallback}</>
}
