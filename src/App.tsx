import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { useEffect, type ReactNode } from 'react'
import { Shell } from './Shell'
import { HomePage } from './HomePage'
import { TitlePage } from './TitlePage'
import { CastPage } from './CastPage'
import { BrowsePage } from './BrowsePage'
import { StatsPage } from './StatsPage'
import { NetworkPage } from './NetworkPage'
import { CollectionPage } from './CollectionPage'
import { AuthScreen } from './AuthScreen'
import { TvLoginScreen } from './TvLoginScreen'
import { ProfileScreen } from './ProfileScreen'
import CollectionsPage from './CollectionsPage'
import { SportsPage } from './SportsPage'
import { DownloadPage } from './DownloadPage'
import { PublicProfilePage } from './PublicProfilePage'
import { ActivityFeedPage } from './ActivityFeedPage'
import { initSpatialNavigation } from './lib/spatial'
import { useAuth } from './context/AuthContext'

// Redirects unauthenticated users to the sign-in screen.
function ProtectedRoute({ children }: { children: ReactNode }) {
  const { session, loading } = useAuth()
  if (loading) return null
  if (!session) return <Navigate replace to="/auth" />
  return <>{children}</>
}

function App() {
  const { settings } = useAuth()
  const { pathname } = useLocation()

  useEffect(() => {
    return initSpatialNavigation()
  }, [])

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])

  return (
    <Routes>
      {/* Public: authentication screen */}
      <Route path="/auth" element={<AuthScreen />} />
      <Route path="/tv-login" element={<TvLoginScreen />} />

      {/* Protected: all app content */}
      <Route
        element={
          <ProtectedRoute>
            <Shell settings={settings} />
          </ProtectedRoute>
        }
      >
        <Route path="/" element={<HomePage />} />
        <Route path="browse" element={<BrowsePage />} />
        <Route path="stats" element={<StatsPage />} />
        <Route path="/title/:mediaType/:id" element={<TitlePage />} />
        <Route path="/person/:id" element={<CastPage />} />
        <Route path="/network/:id" element={<NetworkPage />} />
        <Route path="/collection/:id" element={<CollectionPage />} />
        <Route path="/collections" element={<CollectionsPage />} />
        <Route path="/settings" element={<Navigate replace to="/profile" />} />
        <Route path="/profile" element={<ProfileScreen />} />
        <Route path="/sports" element={<SportsPage />} />
        <Route path="/download" element={<DownloadPage />} />
        <Route path="/user/:username" element={<PublicProfilePage />} />
        <Route path="/feed" element={<ActivityFeedPage />} />
        <Route path="*" element={<Navigate replace to="/" />} />
      </Route>
    </Routes>
  )
}

export default App
