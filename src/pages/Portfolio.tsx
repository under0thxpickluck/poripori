import { Link } from 'react-router-dom'
import { useStore } from '../store/useStore'
import { marketPrice, sellRefund } from '../lib/lmsr'
import { format } from 'date-fns'
import { TrendingUp, TrendingDown } from 'lucide-react'

export default function Portfolio() {
  const { currentUser, markets, positions, getUserTrades } = useStore()
  const user = currentUser()

  if (!user) {
    return (
      <div className="text-center py-20">
        <p className="text-text-muted mb-3">ポートフォリオを表示するにはログインしてください</p>
      </div>
    )
  }

  const myPositions = positions.filter(
    (p) => p.userId === user.id && (p.yesShares > 0 || p.noShares > 0)
  )

  const myTrades = getUserTrades(user.id).slice().reverse()

  type PosWithValue = {
    pos: typeof myPositions[0]
    market: (typeof markets)[0]
    currentValue: number
    pnl: number
    price: { yes: number; no: number }
  }

  const positionsWithValue: PosWithValue[] = myPositions.flatMap((pos) => {
    const market = markets.find((m) => m.id === pos.marketId)
    if (!market) return []

    let currentValue = 0
    if (market.status === 'open') {
      if (pos.yesShares > 0) currentValue += sellRefund(market, 'YES', pos.yesShares)
      if (pos.noShares > 0) currentValue += sellRefund(market, 'NO', pos.noShares)
    } else if (market.status === 'resolved') {
      currentValue = market.resolved === 'YES' ? pos.yesShares : pos.noShares
    }

    const myTotalBuyCost = myTrades
      .filter((t) => t.marketId === market.id && t.action === 'buy')
      .reduce((sum: number, t) => sum + t.cost, 0)
    const myTotalSellGain = myTrades
      .filter((t) => t.marketId === market.id && t.action === 'sell')
      .reduce((sum: number, t) => sum + t.cost, 0)
    const netCost = myTotalBuyCost - myTotalSellGain
    const pnl = currentValue - netCost
    const price = marketPrice(market)

    return [{ pos, market, currentValue, pnl, price }]
  })

  const totalValue = positionsWithValue.reduce((s: number, p: PosWithValue) => s + p.currentValue, 0)
  const totalPnl = positionsWithValue.reduce((s: number, p: PosWithValue) => s + p.pnl, 0)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-text mb-1">ポートフォリオ</h1>
        <p className="text-text-muted text-sm">保有シェアと取引履歴</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-surface border border-border rounded-lg p-5">
          <p className="text-xs text-text-muted mb-2">現在のポイント残高</p>
          <p className="text-3xl font-bold text-text">{user.points.toLocaleString()}</p>
          <p className="text-xs text-text-muted mt-1">pt</p>
        </div>
        <div className="bg-surface border border-border rounded-lg p-5">
          <p className="text-xs text-text-muted mb-2">ポジション現在価値</p>
          <p className="text-3xl font-bold text-text">{totalValue.toFixed(0)}</p>
          <p className="text-xs text-text-muted mt-1">pt</p>
        </div>
        <div className="bg-surface border border-border rounded-lg p-5">
          <p className="text-xs text-text-muted mb-2">含み損益</p>
          <div className="flex items-center gap-2">
            <p className={`text-3xl font-bold ${totalPnl >= 0 ? 'text-yes' : 'text-no'}`}>
              {totalPnl >= 0 ? '+' : ''}{totalPnl.toFixed(0)}
            </p>
            {totalPnl >= 0 ? (
              <TrendingUp size={20} className="text-yes" />
            ) : (
              <TrendingDown size={20} className="text-no" />
            )}
          </div>
          <p className="text-xs text-text-muted mt-1">pt</p>
        </div>
      </div>

      <div className="bg-surface border border-border rounded-lg overflow-hidden">
        <div className="px-5 py-4 border-b border-border">
          <h2 className="text-sm font-semibold text-text">保有ポジション</h2>
        </div>
        {positionsWithValue.length === 0 ? (
          <div className="py-12 text-center text-text-muted">
            <p>保有ポジションがありません</p>
            <Link to="/" className="text-accent hover:underline text-sm mt-2 inline-block">
              マーケットを探す
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {positionsWithValue.map(({ pos, market, currentValue, pnl, price }: PosWithValue) => (
              <Link
                key={pos.marketId}
                to={`/market/${pos.marketId}`}
                className="flex items-center gap-4 px-5 py-4 hover:bg-surface-hover transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-text truncate mb-1">{market.question}</p>
                  <div className="flex items-center gap-3 text-xs text-text-muted">
                    {pos.yesShares > 0 && (
                      <span className="text-yes font-medium">
                        YES {pos.yesShares.toFixed(2)}枚
                      </span>
                    )}
                    {pos.noShares > 0 && (
                      <span className="text-no font-medium">
                        NO {pos.noShares.toFixed(2)}枚
                      </span>
                    )}
                    <span className="text-text-muted">
                      現在 YES {Math.round(price.yes * 100)}%
                    </span>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-medium text-text">{currentValue.toFixed(1)} pt</p>
                  <p className={`text-xs font-medium ${pnl >= 0 ? 'text-yes' : 'text-no'}`}>
                    {pnl >= 0 ? '+' : ''}{pnl.toFixed(1)} pt
                  </p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      <div className="bg-surface border border-border rounded-lg overflow-hidden">
        <div className="px-5 py-4 border-b border-border">
          <h2 className="text-sm font-semibold text-text">取引履歴</h2>
        </div>
        {myTrades.length === 0 ? (
          <div className="py-12 text-center text-text-muted text-sm">取引履歴がありません</div>
        ) : (
          <div className="divide-y divide-border">
            {myTrades.slice(0, 50).map((t) => {
              const market = markets.find((m) => m.id === t.marketId)
              return (
                <div key={t.id} className="flex items-center gap-4 px-5 py-3">
                  <div
                    className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 ${
                      t.side === 'YES' ? 'bg-yes/20 text-yes' : 'bg-no/20 text-no'
                    }`}
                  >
                    {t.side}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-text truncate">
                      {market?.question ?? 'マーケット不明'}
                    </p>
                    <p className="text-xs text-text-muted">
                      {t.action === 'buy' ? '購入' : '売却'} {t.shares.toFixed(2)} シェア @{' '}
                      {(t.pricePerShare * 100).toFixed(1)}¢
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className={`text-sm font-medium ${t.action === 'buy' ? 'text-no' : 'text-yes'}`}>
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
        )}
      </div>
    </div>
  )
}
