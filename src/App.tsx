import { lazy, Suspense } from 'react'
import type { ReactNode } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import AdminGuard from './components/AdminGuard'
import IntroPrism from './components/IntroPrism'
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
const AdminPlinko = lazy(() => import('./pages/admin/Plinko'))

const LegalHub = lazy(() => import('./pages/legal/LegalHub'))
const Terms = lazy(() => import('./pages/legal/Terms'))
const Privacy = lazy(() => import('./pages/legal/Privacy'))
const Cookies = lazy(() => import('./pages/legal/Cookies'))
const MarketIntegrity = lazy(() => import('./pages/legal/MarketIntegrity'))
const Community = lazy(() => import('./pages/legal/Community'))
const Risk = lazy(() => import('./pages/legal/Risk'))
const Compliance = lazy(() => import('./pages/legal/Compliance'))
const Security = lazy(() => import('./pages/legal/Security'))
const Company = lazy(() => import('./pages/Company'))
const Contact = lazy(() => import('./pages/Contact'))
const Status = lazy(() => import('./pages/Status'))
const Press = lazy(() => import('./pages/Press'))
const Faq = lazy(() => import('./pages/Faq'))
const Developers = lazy(() => import('./pages/Developers'))
const Plinko = lazy(() => import('./pages/Plinko'))
const SalonLink = lazy(() => import('./pages/SalonLink'))
const Wallet = lazy(() => import('./pages/Wallet'))

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
    <>
      <IntroPrism />
      <BrowserRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<MarketList />} />
            <Route path="/market/:id" element={<L><MarketDetail /></L>} />
            <Route path="/portfolio" element={<L><Portfolio /></L>} />
            <Route path="/propose" element={<L><Propose /></L>} />
            <Route path="/ranking" element={<L><Ranking /></L>} />
            <Route path="/plinko" element={<L><Plinko /></L>} />
            <Route path="/salon-link" element={<L><SalonLink /></L>} />
            <Route path="/wallet" element={<L><Wallet /></L>} />
            <Route element={<AdminGuard />}>
              <Route path="/admin" element={<L><AdminDashboard /></L>} />
              <Route path="/admin/proposals" element={<L><AdminProposals /></L>} />
              <Route path="/admin/markets/new" element={<L><AdminMarketNew /></L>} />
              <Route path="/admin/markets" element={<L><AdminMarkets /></L>} />
              <Route path="/admin/ads" element={<L><AdminAds /></L>} />
              <Route path="/admin/users" element={<L><AdminUsers /></L>} />
              <Route path="/admin/plinko" element={<L><AdminPlinko /></L>} />
            </Route>

            <Route path="/legal" element={<L><LegalHub /></L>} />
            <Route path="/legal/terms" element={<L><Terms /></L>} />
            <Route path="/legal/privacy" element={<L><Privacy /></L>} />
            <Route path="/legal/cookies" element={<L><Cookies /></L>} />
            <Route path="/legal/market-integrity" element={<L><MarketIntegrity /></L>} />
            <Route path="/legal/community" element={<L><Community /></L>} />
            <Route path="/legal/risk" element={<L><Risk /></L>} />
            <Route path="/legal/compliance" element={<L><Compliance /></L>} />
            <Route path="/legal/security" element={<L><Security /></L>} />
            <Route path="/company" element={<L><Company /></L>} />
            <Route path="/contact" element={<L><Contact /></L>} />
            <Route path="/status" element={<L><Status /></L>} />
            <Route path="/press" element={<L><Press /></L>} />
            <Route path="/faq" element={<L><Faq /></L>} />
            <Route path="/developers" element={<L><Developers /></L>} />
          </Route>
        </Routes>
      </BrowserRouter>
    </>
  )
}
