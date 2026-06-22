import { useParams, Link } from 'react-router-dom'
import { ArrowLeft, Clock, Users, BarChart2, CheckCircle } from 'lucide-react'
import { useStore } from '../store/useStore'
import { marketPrice } from '../lib/lmsr'
import TradePanel from '../components/TradePanel'
import PriceChart from '../components/PriceChart'
import { format } from 'date-fns'
import { ja } from 'date-fns/locale'

export default function MarketDetail() {
  const { id } = useParams<{ id: string }>()
  const { markets, getMarketTrades, users } = useStore()
  const market = markets.find((m) => m.id === id)

  if (!market) {
    return (
      <div className="text-center py-20 text-slate-400">
        <p>マーケットが見つかりません</p>
        <Link to="/" className="text-indigo-400 hover:underline mt-2 inline-block">
          一覧に戻る
        </Link>
      </div>
    )
  }

  const price = marketPrice(market)
  const yesPct = Math.round(price.yes * 100)
  const trades = getMarketTrades(market.id).slice(-20).reverse()
  const uniqueTraders = new Set(trades.map((t) => t.userId)).size

  return (
    <div>
      <Link
        to="/"
        className="inline-flex items-center gap-1 text-sm text-slate-400 hover:text-white mb-6 transition-colors"
      >
        <ArrowLeft size={14} />
        マーケット一覧
      </Link>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-5">
          <div className="bg-[#13162d] border border-[#2a2d4a] rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-400 font-medium">
                {market.category}
              </span>
              {market.status === 'resolved' && (
                <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400">
                  <CheckCircle size={10} />
                  解決済み: {market.resolved}
                </span>
              )}
              {market.status === 'closed' && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-slate-500/20 text-slate-400">
                  締切済み・解決待ち
                </span>
              )}
            </div>

            <h1 className="text-xl font-bold text-white mb-4">{market.question}</h1>

            {market.status !== 'pending' && (
              <div className="flex items-center gap-6 mb-4">
                <div>
                  <p className="text-xs text-slate-400 mb-1">YES</p>
                  <p className="text-2xl font-bold text-emerald-400">{yesPct}%</p>
                </div>
                <div className="flex-1">
                  <div className="flex rounded-full overflow-hidden h-3">
                    <div
                      className="bg-emerald-500 transition-all"
                      style={{ width: `${yesPct}%` }}
                    />
                    <div className="bg-red-500 flex-1" />
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs text-slate-400 mb-1">NO</p>
                  <p className="text-2xl font-bold text-red-400">{100 - yesPct}%</p>
                </div>
              </div>
            )}

            <div className="grid grid-cols-3 gap-4 pt-4 border-t border-[#2a2d4a]">
              <div>
                <p className="text-xs text-slate-500 mb-1 flex items-center gap-1">
                  <BarChart2 size={10} />
                  出来高
                </p>
                <p className="text-sm font-semibold text-white">
                  {market.volume.toLocaleString()} pt
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-500 mb-1 flex items-center gap-1">
                  <Clock size={10} />
                  締切
                </p>
                <p className="text-sm font-semibold text-white">
                  {format(new Date(market.deadline), 'yyyy/MM/dd', { locale: ja })}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-500 mb-1 flex items-center gap-1">
                  <Users size={10} />
                  トレーダー
                </p>
                <p className="text-sm font-semibold text-white">{uniqueTraders} 人</p>
              </div>
            </div>
          </div>

          <div className="bg-[#13162d] border border-[#2a2d4a] rounded-2xl p-5">
            <h2 className="text-sm font-semibold text-slate-400 mb-4">価格推移 (YES)</h2>
            <PriceChart market={market} height={220} />
          </div>

          <div className="bg-[#13162d] border border-[#2a2d4a] rounded-2xl p-5">
            <h2 className="text-sm font-semibold text-white mb-2">解決条件</h2>
            <p className="text-sm text-slate-400 leading-relaxed">{market.description}</p>
          </div>

          {trades.length > 0 && (
            <div className="bg-[#13162d] border border-[#2a2d4a] rounded-2xl overflow-hidden">
              <div className="px-5 py-4 border-b border-[#2a2d4a]">
                <h2 className="text-sm font-semibold text-white">取引履歴</h2>
              </div>
              <div className="divide-y divide-[#1e2244]">
                {trades.map((t) => {
                  const trader = users.find((u) => u.id === t.userId)
                  return (
                    <div key={t.id} className="flex items-center gap-3 px-5 py-3">
                      <div className="w-7 h-7 rounded-full bg-slate-700 flex items-center justify-center text-xs text-slate-300 shrink-0">
                        {trader?.name.charAt(0) ?? '?'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <span className="text-xs text-slate-300">{trader?.name ?? '不明'}</span>
                        <span className="text-xs text-slate-500 mx-1.5">が</span>
                        <span
                          className={`text-xs font-semibold ${
                            t.side === 'YES' ? 'text-emerald-400' : 'text-red-400'
                          }`}
                        >
                          {t.side}
                        </span>
                        <span className="text-xs text-slate-500 mx-1">{t.action === 'buy' ? '購入' : '売却'}</span>
                        <span className="text-xs text-white">{t.shares.toFixed(1)} シェア</span>
                      </div>
                      <div className="text-right shrink-0">
                        <p className={`text-xs font-medium ${t.action === 'buy' ? 'text-red-400' : 'text-emerald-400'}`}>
                          {t.action === 'buy' ? '-' : '+'}{t.cost.toFixed(1)} pt
                        </p>
                        <p className="text-xs text-slate-500">
                          {format(new Date(t.timestamp), 'MM/dd HH:mm')}
                        </p>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        <div className="lg:col-span-1">
          <div className="sticky top-20">
            <TradePanel market={market} />
          </div>
        </div>
      </div>
    </div>
  )
}
