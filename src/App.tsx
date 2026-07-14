import { useState } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import SplashScreen from './pages/SplashScreen'
import LoginPage from './pages/LoginPage'
import JoinPage from './pages/JoinPage'
import RequestClubPage from './pages/RequestClubPage'
import AdminClubRequestsPage from './pages/AdminClubRequestsPage'
import ManagePage from './pages/ManagePage'
import MembersPage from './pages/MembersPage'
import HomePage from './pages/HomePage'
import PlayersPage from './pages/PlayersPage'
import PlayerEditorPage from './pages/PlayerEditorPage'
import MatchDayListPage from './pages/MatchDayListPage'
import MatchDaySetupPage from './pages/MatchDaySetupPage'
import MatchDayEditPage from './pages/MatchDayEditPage'
import SettingsPage from './pages/SettingsPage'
import ChangelogPage from './pages/ChangelogPage'
import UpdateBanner from './components/UpdateBanner'
import ScrollToTop from './components/ScrollToTop'
import OnboardingGuide, { shouldShowOnboarding } from './components/OnboardingGuide'
import ProtectedShell from './components/ProtectedShell'
import PreviewRoleBanner from './components/PreviewRoleBanner'
import LineupPage from './pages/LineupPage'

export default function App() {
  const [showOnboarding, setShowOnboarding] = useState(shouldShowOnboarding)

  return (
    <>
      <Routes>
        {/* Öffentlich (außerhalb des Auth-Gates) */}
        <Route path="/" element={<SplashScreen />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/join/:token" element={<JoinPage />} />

        {/* Eingeloggter Bereich */}
        <Route element={<ProtectedShell />}>
          <Route path="/home" element={<HomePage />} />
          <Route path="/players" element={<PlayersPage />} />
          <Route path="/players/:id" element={<PlayerEditorPage />} />
          <Route path="/matchday" element={<MatchDayListPage />} />
          <Route path="/matchday/new" element={<MatchDaySetupPage />} />
          <Route path="/matchday/:id/edit" element={<MatchDayEditPage />} />
          <Route path="/settings" element={<SettingsPage onStartTour={() => setShowOnboarding(true)} />} />
          <Route path="/changelog" element={<ChangelogPage />} />
          <Route path="/lineup/:id" element={<LineupPage />} />
          <Route path="/request-club" element={<RequestClubPage />} />
          <Route path="/admin/club-requests" element={<AdminClubRequestsPage />} />
          <Route path="/manage" element={<ManagePage />} />
          <Route path="/members" element={<MembersPage />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <ScrollToTop />
      <PreviewRoleBanner />
      <UpdateBanner />
      {showOnboarding && <OnboardingGuide onDone={() => setShowOnboarding(false)} />}
    </>
  )
}
