import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'

export type Theme = 'light' | 'dark' | 'system'
type Resolved = 'light' | 'dark'

const STORAGE_KEY = 'hornstrike_theme'

function readStored(): Theme {
  const v = localStorage.getItem(STORAGE_KEY)
  return v === 'light' || v === 'dark' || v === 'system' ? v : 'dark'
}

function systemPrefersDark(): boolean {
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? true
}

function resolve(theme: Theme): Resolved {
  return theme === 'system' ? (systemPrefersDark() ? 'dark' : 'light') : theme
}

function apply(resolved: Resolved) {
  document.documentElement.setAttribute('data-theme', resolved)
  // Mobile-Browser-Chrome (Statusleiste) an das Theme anpassen
  document.querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', resolved === 'dark' ? '#1a0533' : '#cabfe4')
}

interface Ctx {
  theme: Theme
  resolved: Resolved
  setTheme: (t: Theme) => void
}

const ThemeContext = createContext<Ctx | null>(null)

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(readStored)
  const [resolved, setResolved] = useState<Resolved>(() => resolve(readStored()))

  useEffect(() => {
    const r = resolve(theme)
    apply(r)
    setResolved(r)
    // Nur bei 'system' auf OS-Umschaltung reagieren
    if (theme !== 'system') return
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => {
      const next: Resolved = systemPrefersDark() ? 'dark' : 'light'
      apply(next)
      setResolved(next)
    }
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [theme])

  const setTheme = (t: Theme) => {
    localStorage.setItem(STORAGE_KEY, t)
    setThemeState(t)
  }

  return <ThemeContext.Provider value={{ theme, resolved, setTheme }}>{children}</ThemeContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useTheme(): Ctx {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider')
  return ctx
}
