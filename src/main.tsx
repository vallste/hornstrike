import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter as BrowserRouter } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import './index.css'
import App from './App'
import { PlayersProvider, MatchDaysProvider } from './store'
import { SessionProvider } from './context/SessionProvider'
import { queryClient } from './lib/queryClient'
import { runMigrations } from './utils/schema'

// Migrations vor dem ersten Render ausführen
runMigrations()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <SessionProvider>
          <PlayersProvider>
            <MatchDaysProvider>
              <App />
            </MatchDaysProvider>
          </PlayersProvider>
        </SessionProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>
)
