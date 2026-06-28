import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ArrowLeft, Clock, Users, BarChart2, CheckCircle, TrendingUp } from 'lucide-react'
import { useStore } from '../store/useStore'
import { marketPrice } from '../lib/lmsr'
import { displayName } from '../lib/names'
import TradePanel from '../components/TradePanel'
import BottomSheet from '../components/BottomSheet'
import PriceChart from '../components/PriceChart'
import MarketImage from '../components/MarketImage'
import OrderBook from '../components/OrderBook'
import TopHolders from '../components/TopHolders'
import Comments from '../components/Comments'
import Countdown from '../components/Countdown'
import { usePriceFlash } from '../hooks/usePriceFlash'
import { format } from 'date-fns'
import { ja } from 'date-fns/locale'

export default function MarketDetail() {
  const { id } = useParams<{ id: string }>()
  const { markets, getMarketTrades, users, currentUserId } = useStore()
  const market = markets.find((m) => m.id === id)
  const [sheetOpen, setSheetOpen] = useState(false)

  const yesForFlash = market && market.status !== 'pending' ? Math.round(marketPrice(market).yes * 100) : 0
  const priceFlash = usePriceFlash(yesForFlash)

  if (!market) {
    return (
      <div className="text-center py-20 text-text-muted">
        <p>マーケットが見つかりません</p>
        <Link to="/" className="text-accent hover:underline mt-2 inline-block">
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
        className="inline-flex items-center gap-1 text-sm text-text-muted hover:text-text mb-6 transition-colors"
      >
        <ArrowLeft size={14} />
        マーケット一覧
      </Link>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-5">
          <div className="bg-surface border border-border rounded-lg p-5">
            <div className="flex gap-4 mb-4">
              <MarketImage
                src={market.imageUrl}
                yes={price.yes}
                category={market.category}
                className="w-16 h-16 sm:w-20 sm:h-20 rounded-lg shrink-0"
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  <span className="text-xs px-2 py-0.5 rounded-full bg-accent/15 text-accent font-medium">
                    {market.category}
                  </span>
                  {market.status === 'resolved' && (
                    <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-yes/20 text-yes">
                      <CheckCircle size={10} />
                      解決済み: {market.resolved}
                    </span>
                  )}
                  {market.status === 'closed' && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-surface-hover text-text-muted">
                      締切済み・解決待ち
                    </span>
                  )}
                  {market.extendedCount > 0 && (
                    <span
                      className="text-xs px-2 py-0.5 rounded-full bg-accent/15 text-accent"
                      title={
                        market.lastExtendedAt
                          ? `最終延長: ${format(new Date(market.lastExtendedAt), 'yyyy/MM/dd HH:mm', { locale: ja })}`
                          : undefined
                      }
                    >
                      延長済み ×{market.extendedCount}
                    </span>
                  )}
                </div>
                <h1 className="text-xl font-bold text-text leading-snug">{market.question}</h1>
              </div>
            </div>

            {market.status !== 'pending' && (
              <div className="flex items-center gap-6 mb-4">
                <div>
                  <p className="text-xs text-text-muted mb-1">YES</p>
                  <p className={`text-2xl font-bold text-yes rounded px-1 -mx-1 ${priceFlash}`}>{yesPct}%</p>
                </div>
                <div className="flex-1">
                  <div className="flex rounded-full overflow-hidden h-3">
                    <div
                      className="bg-yes transition-all"
                      style={{ width: `${yesPct}%` }}
                    />
                    <div className="bg-no flex-1" />
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs text-text-muted mb-1">NO</p>
                  <p className={`text-2xl font-bold text-no rounded px-1 -mx-1 ${priceFlash}`}>{100 - yesPct}%</p>
                </div>
              </div>
            )}

            <div className="grid grid-cols-3 gap-4 pt-4 border-t border-border">
              <div>
                <p className="text-xs text-text-muted mb-1 flex items-center gap-1">
                  <BarChart2 size={10} />
                  出来高
                </p>
                <p className="text-sm font-semibold text-text">
                  {market.volume.toLocaleString()} pt
                </p>
              </div>
              <div>
                <p className="text-xs text-text-muted mb-1 flex items-center gap-1">
                  <Clock size={10} />
                  締切
                </p>
                <p className="text-sm font-semibold text-text">
                  {format(new Date(market.deadline), 'yyyy/MM/dd', { locale: ja })}
                </p>
                {market.status === 'open' && (
                  <Countdown deadline={market.deadline} className="text-xs" />
                )}
              </div>
              <div>
                <p className="text-xs text-text-muted mb-1 flex items-center gap-1">
                  <Users size={10} />
                  トレーダー
                </p>
                <p className="text-sm font-semibold text-text">{uniqueTraders} 人</p>
              </div>
            </div>
          </div>

          <div className="bg-surface border border-border rounded-lg p-5">
            <h2 className="text-sm font-semibold text-text-muted mb-4">価格推移 (YES)</h2>
            <PriceChart market={market} height={300} />
          </div>

          <div className="bg-surface border border-border rounded-lg p-5">
            <h2 className="text-sm font-semibold text-text mb-2">ルール</h2>
            <p className="text-sm text-text-muted leading-relaxed">{market.description}</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <OrderBook market={market} />
            <TopHolders marketId={market.id} />
          </div>

          {trades.length > 0 && (
            <div className="bg-surface border border-border rounded-lg overflow-hidden">
              <div className="px-5 py-4 border-b border-border">
                <h2 className="text-sm font-semibold text-text">取引履歴</h2>
              </div>
              <div className="divide-y divide-border">
                {trades.map((t) => {
                  const trader = users.find((u) => u.id === t.userId)
                  return (
                    <div key={t.id} className="flex items-center gap-3 px-5 py-3">
                      <div className="w-7 h-7 rounded-full bg-surface-hover flex items-center justify-center text-xs text-text shrink-0">
                        {trader?.name.charAt(0) ?? '?'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <span className="text-xs text-text">{displayName(trader?.name ?? '不明', t.userId, currentUserId)}</span>
                        <span className="text-xs text-text-muted mx-1.5">が</span>
                        <span
                          className={`text-xs font-semibold ${
                            t.side === 'YES' ? 'text-yes' : 'text-no'
                          }`}
                        >
                          {t.side}
                        </span>
                        <span className="text-xs text-text-muted mx-1">{t.action === 'buy' ? '購入' : '売却'}</span>
                        <span className="text-xs text-text">{t.shares.toFixed(1)} シェア</span>
                      </div>
                      <div className="text-right shrink-0">
                        <p className={`text-xs font-medium ${t.action === 'buy' ? 'text-no' : 'text-yes'}`}>
                          {t.action === 'buy' ? '-' : '+'}{t.cost.toFixed(1)} pt
                        </p>
                        <p className="text-xs text-text-muted">
                          {format(new Date(t.timestamp), 'MM/dd HH:mm')}
                        </p>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          <Comments marketId={market.id} />
        </div>

        <div className="hidden lg:block lg:col-span-1">
          <div className="sticky top-20">
            <TradePanel market={market} />
          </div>
        </div>
      </div>

      {market.status === 'open' && <div className="h-16 lg:hidden" />}

      {/* スマホ用の固定トレードCTA（下部タブバーの上に配置） */}
      {market.status === 'open' && (
        <div className="lg:hidden fixed inset-x-0 bottom-[calc(3.5rem_+_env(safe-area-inset-bottom))] z-30 px-4 pb-2 pt-3 bg-gradient-to-t from-bg via-bg/95 to-transparent">
          <button
            onClick={() => setSheetOpen(true)}
            className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-accent hover:bg-accent-hover text-white font-bold shadow-lg active:scale-[0.99] transition-transform"
          >
            <TrendingUp size={18} />
            トレードする（YES {yesPct}% / NO {100 - yesPct}%）
          </button>
        </div>
      )}

      {sheetOpen && (
        <BottomSheet title="トレード" onClose={() => setSheetOpen(false)}>
          <div className="p-4">
            <TradePanel market={market} />
          </div>
        </BottomSheet>
      )}
    </div>
  )
}
