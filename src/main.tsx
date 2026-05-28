import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter as BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App'
import { PlayersProvider, MatchDaysProvider } from './store'
import { runMigrations } from './utils/schema'

// Migrations vor dem ersten Render ausführen
runMigrations()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <PlayersProvider>
        <MatchDaysProvider>
          <App />
        </MatchDaysProvider>
      </PlayersProvider>
    </BrowserRouter>
  </StrictMode>
)
