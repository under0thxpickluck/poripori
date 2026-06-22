import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import MarketList from './pages/MarketList'
import MarketDetail from './pages/MarketDetail'
import Portfolio from './pages/Portfolio'
import Propose from './pages/Propose'
import Ranking from './pages/Ranking'
import AdminDashboard from './pages/admin/Dashboard'
import AdminProposals from './pages/admin/Proposals'
import AdminMarkets from './pages/admin/Markets'
import AdminMarketNew from './pages/admin/MarketNew'
import AdminAds from './pages/admin/Ads'
import AdminUsers from './pages/admin/Users'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<MarketList />} />
          <Route path="/market/:id" element={<MarketDetail />} />
          <Route path="/portfolio" element={<Portfolio />} />
          <Route path="/propose" element={<Propose />} />
          <Route path="/ranking" element={<Ranking />} />
          <Route path="/admin" element={<AdminDashboard />} />
          <Route path="/admin/proposals" element={<AdminProposals />} />
          <Route path="/admin/markets/new" element={<AdminMarketNew />} />
          <Route path="/admin/markets" element={<AdminMarkets />} />
          <Route path="/admin/ads" element={<AdminAds />} />
          <Route path="/admin/users" element={<AdminUsers />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
