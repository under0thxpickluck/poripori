import { Link } from 'react-router-dom'
import { useStore } from '../store/useStore'
import { marketPrice, sellRefund } from '../lib/lmsr'
import { format } from 'date-fns'
import { TrendingUp, TrendingDown, Wallet, PieChart, Layers, Activity } from 'lucide-react'
import CountUp from '../components/CountUp'

const CAT_BAR: Record<string, string> = {
  Politics: 'bg-blue-400',
  Crypto: 'bg-orange-400',
  Sports: 'bg-green-400',
  AI: 'bg-purple-400',
  Tech: 'bg-cyan-400',
  Science: 'bg-sky-400',
  Entertainment: 'bg-pink-400',
}

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

  positionsWithValue.sort((a, b) => b.currentValue - a.currentValue)

  const totalValue = positionsWithValue.reduce((s, p) => s + p.currentValue, 0)
  const totalPnl = positionsWithValue.reduce((s, p) => s + p.pnl, 0)
  const totalAssets = user.points + totalValue

  // 取引サマリー
  const winners = positionsWithValue.filter((p) => p.pnl > 0).length
  const losers = positionsWithValue.filter((p) => p.pnl < 0).length
  const winRate = winners + losers > 0 ? Math.round((winners / (winners + losers)) * 100) : 0

  // カテゴリ別の保有内訳
  const allocMap = new Map<string, number>()
  positionsWithValue.forEach((p) => {
    allocMap.set(p.market.category, (allocMap.get(p.market.category) ?? 0) + p.currentValue)
  })
  const alloc = [...allocMap.entries()]
    .map(([category, value]) => ({ category, value }))
    .sort((a, b) => b.value - a.value)
  const allocTotal = alloc.reduce((s, a) => s + a.value, 0)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-text mb-1">ポートフォリオ</h1>
        <p className="text-text-muted text-sm">資産・保有シェア・取引履歴</p>
      </div>

      {/* サマリー4カード */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-surface border border-border rounded-lg p-5">
          <Wallet size={16} className="text-accent mb-2" />
          <p className="text-2xl font-bold text-text">
            <CountUp value={Math.round(user.points)} />
          </p>
          <p className="text-xs text-text-muted mt-1">残高 (pt)</p>
        </div>
        <div className="bg-surface border border-border rounded-lg p-5">
          <Layers size={16} className="text-accent mb-2" />
          <p className="text-2xl font-bold text-text">
            <CountUp value={Math.round(totalValue)} />
          </p>
          <p className="text-xs text-text-muted mt-1">ポジション価値 (pt)</p>
        </div>
        <div className="bg-surface border border-border rounded-lg p-5">
          {totalPnl >= 0 ? (
            <TrendingUp size={16} className="text-yes mb-2" />
          ) : (
            <TrendingDown size={16} className="text-no mb-2" />
          )}
          <p className={`text-2xl font-bold ${totalPnl >= 0 ? 'text-yes' : 'text-no'}`}>
            <CountUp value={Math.round(totalPnl)} format={(n) => `${n >= 0 ? '+' : ''}${n.toLocaleString()}`} />
          </p>
          <p className="text-xs text-text-muted mt-1">含み損益 (pt)</p>
        </div>
        <div className="bg-surface border border-border rounded-lg p-5">
          <PieChart size={16} className="text-accent mb-2" />
          <p className="text-2xl font-bold text-text">
            <CountUp value={Math.round(totalAssets)} />
          </p>
          <p className="text-xs text-text-muted mt-1">総資産 (pt)</p>
        </div>
      </div>

      {/* 取引サマリー + 保有内訳 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-surface border border-border rounded-lg p-5">
          <h2 className="text-sm font-semibold text-text mb-4 flex items-center gap-1.5">
            <Activity size={14} />
            取引サマリー
          </h2>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <p className="text-xl font-bold text-text">
                <CountUp value={myTrades.length} />
              </p>
              <p className="text-xs text-text-muted mt-0.5">取引回数</p>
            </div>
            <div>
              <p className="text-xl font-bold text-text">
                <CountUp value={positionsWithValue.length} />
              </p>
              <p className="text-xs text-text-muted mt-0.5">保有マーケット</p>
            </div>
            <div>
              <p className="text-xl font-bold text-text">
                <CountUp value={winRate} format={(n) => `${n}%`} />
              </p>
              <p className="text-xs text-text-muted mt-0.5">勝率（{winners}勝{losers}敗）</p>
            </div>
          </div>
        </div>

        <div className="bg-surface border border-border rounded-lg p-5">
          <h2 className="text-sm font-semibold text-text mb-4 flex items-center gap-1.5">
            <PieChart size={14} />
            保有内訳（カテゴリ別）
          </h2>
          {alloc.length === 0 ? (
            <p className="text-sm text-text-muted py-2">保有ポジションがありません</p>
          ) : (
            <div className="space-y-2.5">
              {alloc.map((a) => {
                const pct = allocTotal > 0 ? Math.round((a.value / allocTotal) * 100) : 0
                return (
                  <div key={a.category}>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-text">{a.category}</span>
                      <span className="text-text-muted">{pct}% ・ {a.value.toFixed(0)} pt</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-surface-hover overflow-hidden">
                      <div
                        className={`h-full rounded-full ${CAT_BAR[a.category] ?? 'bg-accent'}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
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
