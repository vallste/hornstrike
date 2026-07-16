import { NavLink } from 'react-router-dom'
import type { ReactNode } from 'react'
import { useCan } from '../lib/permissions'

// Einheitliches Linien-Icon-Set (currentColor) – ersetzt die bunt gemischten Emojis.
const svg = (children: ReactNode) => (
  <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor"
    strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" className="w-[26px] h-[26px]">
    {children}
  </svg>
)

const ICONS: Record<string, ReactNode> = {
  home: svg(<><path d="M3.5 10.5 12 4l8.5 6.5" /><path d="M5.5 9.5V19a1 1 0 0 0 1 1h11a1 1 0 0 0 1-1V9.5" /><path d="M10 20v-5h4v5" /></>),
  players: svg(<><circle cx="9" cy="8" r="3.1" /><path d="M3.6 19.2a5.6 5.6 0 0 1 10.8 0" /><path d="M16 5.4a3 3 0 0 1 0 5.7" /><path d="M17.4 14.2a5.4 5.4 0 0 1 3 4.9" /></>),
  match: svg(<><rect x="3.2" y="5.5" width="17.6" height="13" rx="2" /><path d="M12 5.5v13" /><circle cx="12" cy="12" r="2.4" /><path d="M3.2 9.2h2.3v5.6H3.2M20.8 9.2h-2.3v5.6h2.3" /></>),
  club: svg(<><path d="M3.5 9 12 4.2 20.5 9" /><path d="M5.4 9.6v8.4M9.8 9.6v8.4M14.2 9.6v8.4M18.6 9.6v8.4" /><path d="M3.6 20.4h16.8" /></>),
  more: svg(<><circle cx="12" cy="12" r="3" /><path d="M12 3v2.2M12 18.8V21M4.5 7.5l1.9 1.1M17.6 15.4l1.9 1.1M4.5 16.5l1.9-1.1M17.6 8.6l1.9-1.1" /></>),
}

const baseTabs = [
  { to: '/home', icon: 'home', label: 'Home' },
  { to: '/players', icon: 'players', label: 'Spieler' },
  { to: '/matchday', icon: 'match', label: 'Spieltag' },
]

export default function BottomNav() {
  const canManageClub = useCan('club:manageTeams')

  const tabs = [
    ...baseTabs,
    ...(canManageClub ? [{ to: '/manage', icon: 'club', label: 'Verein' }] : []),
    { to: '/settings', icon: 'more', label: canManageClub ? 'Mehr' : 'Einstellungen' },
  ]

  return (
    <nav className="fixed bottom-0 left-0 right-0 h-20 bg-surface flex items-center justify-around px-2 z-40">
      {tabs.map(tab => (
        <NavLink
          key={tab.to}
          to={tab.to}
          end={false}
          className={({ isActive }) =>
            `relative flex flex-col items-center justify-center gap-1 h-14 w-16 transition-colors ${isActive ? 'text-accent-pink' : 'text-fg/40'}`
          }
        >
          {({ isActive }) => (
            <>
              {ICONS[tab.icon]}
              <span className="text-[11px] font-medium whitespace-nowrap leading-none">{tab.label}</span>
              {/* Dot absolut positioniert – unabhängig von Icon-Metriken immer gleicher Abstand */}
              <span className={`absolute bottom-0.5 w-1 h-1 rounded-full bg-accent-pink transition-opacity ${isActive ? 'opacity-100' : 'opacity-0'}`} />
            </>
          )}
        </NavLink>
      ))}
    </nav>
  )
}
