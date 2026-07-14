import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter as BrowserRouter } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import './index.css'
import App from './App'
import { SessionProvider } from './context/SessionProvider'
import { PreviewRoleProvider } from './context/PreviewRoleProvider'
import { ScopeProvider } from './context/ScopeProvider'
import { queryClient } from './lib/queryClient'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <SessionProvider>
          <PreviewRoleProvider>
            <ScopeProvider>
              <App />
            </ScopeProvider>
          </PreviewRoleProvider>
        </SessionProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>
)
