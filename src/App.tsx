import { Routes, Route, Navigate } from 'react-router-dom'
import SplashScreen from './pages/SplashScreen'
import HomePage from './pages/HomePage'
import PlayersPage from './pages/PlayersPage'
import PlayerEditorPage from './pages/PlayerEditorPage'
import MatchDayListPage from './pages/MatchDayListPage'
import MatchDaySetupPage from './pages/MatchDaySetupPage'
import MatchDayEditPage from './pages/MatchDayEditPage'
import SettingsPage from './pages/SettingsPage'
import UpdateBanner from './components/UpdateBanner'
import LineupPage from './pages/LineupPage'

export default function App() {
  return (
    <>
      <Routes>
        <Route path="/" element={<SplashScreen />} />
        <Route path="/home" element={<HomePage />} />
        <Route path="/players" element={<PlayersPage />} />
        <Route path="/players/:id" element={<PlayerEditorPage />} />
        <Route path="/matchday" element={<MatchDayListPage />} />
        <Route path="/matchday/new" element={<MatchDaySetupPage />} />
        <Route path="/matchday/:id/edit" element={<MatchDayEditPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/lineup/:id" element={<LineupPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <UpdateBanner />
    </>
  )
}
