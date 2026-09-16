import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useSession } from '../context/SessionProvider'
import {
  loadQueue, setQueueAuthorized, setQueueHandlers, drain, type QueuedOp,
} from '../lib/liveQueue'
import { applyQueued, type LiveData } from '../store/live'

const EMPTY: LiveData = { sets: [], events: [], opponents: [] }

/**
 * Unsichtbarer Läufer für die Warteschlange der Live-Erfassung.
 *
 * Liegt in App, nicht in der Live-Seite: wartende Tore müssen auch dann noch
 * beim Server ankommen, wenn man längst weitergeblättert hat – oder die App
 * neu gestartet wurde und die Seite gar nicht offen ist.
 */
export default function LiveSyncMount() {
  const qc = useQueryClient()
  const { session } = useSession()

  useEffect(() => { loadQueue() }, [])

  useEffect(() => {
    setQueueHandlers({
      onApplied: (op: QueuedOp) => {
        const key = ['matchLive', op.matchdayId]
        // Den Vorgang im selben Zug in den Cache übernehmen: sonst verschwände
        // das Tor kurz, zwischen „nicht mehr in der Warteschlange" und
        // „vom Server nachgeladen".
        qc.setQueryData<LiveData>(key, prev => applyQueued(prev ?? EMPTY, op))
        void qc.invalidateQueries({ queryKey: key })
        if (op.body.kind === 'status') {
          void qc.invalidateQueries({ queryKey: ['matchDays'] })
        } else {
          void qc.invalidateQueries({ queryKey: ['matchDays'], refetchType: 'none' })
        }
      },
      onRejected: (op: QueuedOp) => {
        // Nicht übernehmen – der Server hat die Eingabe nicht angenommen.
        // Die Seite zeigt sie unter „verworfen", der Nachzug korrigiert den Stand.
        void qc.invalidateQueries({ queryKey: ['matchLive', op.matchdayId] })
      },
    })
    return () => setQueueHandlers({})
  }, [qc])

  useEffect(() => {
    setQueueAuthorized(!!session)
    if (session) void drain()
  }, [session])

  return null
}
