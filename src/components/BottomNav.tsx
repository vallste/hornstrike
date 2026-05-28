import { NavLink } from 'react-router-dom'

const tabs = [
  { to: '/home', icon: '🏠', label: 'Home' },
  { to: '/players', icon: '👥', label: 'Spieler' },
  { to: '/matchday', icon: '⚽', label: 'Spieltag' },
  { to: '/settings', icon: '⚙', label: 'Einstellungen' },
]

export default function BottomNav() {
  return (
    <nav className="fixed bottom-0 left-0 right-0 h-20 bg-[#2b0b4c] flex items-center justify-around px-8 z-40">
      {tabs.map(tab => (
        <NavLink
          key={tab.to}
          to={tab.to}
          end={false}
          className={({ isActive }) =>
            `flex flex-col items-center gap-1 transition-colors ${isActive ? 'text-unicorn-pink' : 'text-white/40'}`
          }
        >
          {({ isActive }) => (
            <>
              <span className="text-2xl">{tab.icon}</span>
              <span className="text-[11px] font-medium">{tab.label}</span>
              {isActive && <span className="w-1 h-1 rounded-full bg-unicorn-pink" />}
            </>
          )}
        </NavLink>
      ))}
    </nav>
  )
}
