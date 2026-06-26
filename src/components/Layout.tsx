import { Outlet, useLocation } from 'react-router-dom'
import Navbar from './Navbar'
import Footer from './Footer'
import CommandPalette from './CommandPalette'
import ActivityToasts from './ActivityToasts'
import MobileTabBar from './MobileTabBar'
import DailyBonus from './DailyBonus'
import LevelUpToast from './LevelUpToast'
import AuthBridge from './AuthBridge'
import DataLoader from './DataLoader'
import RealtimeSync from './RealtimeSync'
import ErrorBoundary from './ErrorBoundary'
import ErrorToast from './ErrorToast'

export default function Layout() {
  const { pathname } = useLocation()
  return (
    <div className="min-h-screen bg-bg flex flex-col">
      <Navbar />
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 py-6 pb-24 md:pb-6">
        {/* key を pathname にして、ページ遷移でエラーバウンダリを自動リセット */}
        <ErrorBoundary key={pathname}>
          <Outlet />
        </ErrorBoundary>
      </main>
      <Footer />
      <CommandPalette />
      <AuthBridge />
      <DataLoader />
      <RealtimeSync />
      <ErrorToast />
      <ActivityToasts />
      <MobileTabBar />
      <DailyBonus />
      <LevelUpToast />
    </div>
  )
}
