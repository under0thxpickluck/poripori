import { lazy, Suspense } from 'react'
import type { ReactNode } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import MarketList from './pages/MarketList'

// ホーム以外は遅延読み込み（recharts等を初期バンドルから分離し、スマホの初回表示を軽く）
const MarketDetail = lazy(() => import('./pages/MarketDetail'))
const Portfolio = lazy(() => import('./pages/Portfolio'))
const Propose = lazy(() => import('./pages/Propose'))
const Ranking = lazy(() => import('./pages/Ranking'))
const AdminDashboard = lazy(() => import('./pages/admin/Dashboard'))
const AdminProposals = lazy(() => import('./pages/admin/Proposals'))
const AdminMarkets = lazy(() => import('./pages/admin/Markets'))
const AdminMarketNew = lazy(() => import('./pages/admin/MarketNew'))
const AdminAds = lazy(() => import('./pages/admin/Ads'))
const AdminUsers = lazy(() => import('./pages/admin/Users'))

function PageFallback() {
  return (
    <div className="flex justify-center py-24">
      <div className="w-8 h-8 rounded-full border-2 border-border border-t-accent animate-spin" />
    </div>
  )
}

function L({ children }: { children: ReactNode }) {
  return <Suspense fallback={<PageFallback />}>{children}</Suspense>
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<MarketList />} />
          <Route path="/market/:id" element={<L><MarketDetail /></L>} />
          <Route path="/portfolio" element={<L><Portfolio /></L>} />
          <Route path="/propose" element={<L><Propose /></L>} />
          <Route path="/ranking" element={<L><Ranking /></L>} />
          <Route path="/admin" element={<L><AdminDashboard /></L>} />
          <Route path="/admin/proposals" element={<L><AdminProposals /></L>} />
          <Route path="/admin/markets/new" element={<L><AdminMarketNew /></L>} />
          <Route path="/admin/markets" element={<L><AdminMarkets /></L>} />
          <Route path="/admin/ads" element={<L><AdminAds /></L>} />
          <Route path="/admin/users" element={<L><AdminUsers /></L>} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
