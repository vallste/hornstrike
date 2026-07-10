import { QueryClient } from '@tanstack/react-query'

/**
 * Zentraler Query-Cache für den Server-State (players, matchDays, memberships, …).
 * Wird ab Phase 1 von der Datenschicht (src/store) genutzt; in Phase 0 nur
 * bereitgestellt, ohne Verhalten zu ändern.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
      refetchOnWindowFocus: true,
    },
  },
})
