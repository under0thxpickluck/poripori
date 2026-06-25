import { Outlet } from 'react-router-dom'
import Navbar from './Navbar'
import Footer from './Footer'
import CommandPalette from './CommandPalette'
import ActivityToasts from './ActivityToasts'
import MobileTabBar from './MobileTabBar'
import DailyBonus from './DailyBonus'
import LevelUpToast from './LevelUpToast'

export default function Layout() {
  return (
    <div className="min-h-screen bg-bg flex flex-col">
      <Navbar />
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 py-6 pb-24 md:pb-6">
        <Outlet />
      </main>
      <Footer />
      <CommandPalette />
      <ActivityToasts />
      <MobileTabBar />
      <DailyBonus />
      <LevelUpToast />
    </div>
  )
}
