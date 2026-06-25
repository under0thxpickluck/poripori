import { useState, useCallback } from 'react'
import { CheckCircle2, AlertTriangle } from 'lucide-react'
import { useStore } from '../store/useStore'
import { buyCost, sellRefund, sharesForPoints, marketPrice } from '../lib/lmsr'
import type { Market } from '../types'
import Confetti from './Confetti'

type Tab = 'buy' | 'sell'
type Side = 'YES' | 'NO'

type Props = { market: Market }

const QUICK = [0.25, 0.5, 0.75, 1]

export default function TradePanel({ market }: Props) {
  const { currentUser, buyShares, sellShares, getPosition } = useStore()
  const user = currentUser()
  const [tab, setTab] = useState<Tab>('buy')
  const [side, setSide] = useState<Side>('YES')
  const [inputMode, setInputMode] = useState<'points' | 'shares'>('points')
  const [amount, setAmount] = useState('')
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null)
  const [burst, setBurst] = useState(0)

  const pos = user ? getPosition(user.id, market.id) : { yesShares: 0, noShares: 0, userId: '', marketId: '' }
  const price = marketPrice(market)
  const held = side === 'YES' ? pos.yesShares : pos.noShares

  const amtNum = parseFloat(amount) || 0

  const preview = useCallback(() => {
    if (amtNum <= 0) return null
    if (tab === 'buy') {
      if (inputMode === 'points') {
        const shares = sharesForPoints(market, side, amtNum)
        const cost = buyCost(market, side, shares)
        return { shares, cost, pricePerShare: shares > 0 ? cost / shares : 0 }
      } else {
        const cost = buyCost(market, side, amtNum)
        return { shares: amtNum, cost, pricePerShare: amtNum > 0 ? cost / amtNum : 0 }
      }
    } else {
      const sharesToSell = amtNum
      if (sharesToSell > held) return null
      const refund = sellRefund(market, side, sharesToSell)
      return { shares: sharesToSell, cost: refund, pricePerShare: sharesToSell > 0 ? refund / sharesToSell : 0 }
    }
  }, [amtNum, tab, side, inputMode, market, held])

  const pv = preview()

  // スライダー/クイック％の最大値
  const sliderMax =
    tab === 'sell'
      ? held
      : inputMode === 'points'
      ? user?.points ?? 0
      : sharesForPoints(market, side, user?.points ?? 0)
  const sliderStep = tab === 'buy' && inputMode === 'shares' ? 0.01 : 1

  function setPct(p: number) {
    if (tab === 'buy') setInputMode((m) => m) // keep mode
    const v = sliderMax * p
    setAmount(sliderStep < 1 ? v.toFixed(2) : String(Math.floor(v)))
  }

  async function handleExecute() {
    if (!pv || !user) return
    const r = tab === 'buy'
      ? await buyShares(market.id, side, pv.shares)
      : await sellShares(market.id, side, pv.shares)
    if (r.success) {
      setResult({
        success: true,
        message:
          tab === 'buy'
            ? `${pv.shares.toFixed(2)} ${side} シェアを購入しました`
            : `${pv.shares.toFixed(2)} ${side} シェアを売却しました`,
      })
      setAmount('')
      setBurst((b) => b + 1)
      navigator.vibrate?.(15) // スマホで軽い触覚フィードバック
    } else {
      navigator.vibrate?.([8, 40, 8])
      setResult({ success: false, message: r.error ?? 'エラーが発生しました' })
    }
    setTimeout(() => setResult(null), 3000)
  }

  const canTrade = market.status === 'open'
  const insufficient = tab === 'buy' && pv != null && user != null && pv.cost > user.points
  const notEnoughShares = tab === 'sell' && amtNum > held

  // 想定リターン（的中時 1シェア=1pt）
  const payout = pv ? pv.shares : 0
  const profit = pv ? payout - pv.cost : 0
  const roi = pv && pv.cost > 0 ? (profit / pv.cost) * 100 : 0

  // 保有ポジションの現在価値
  const yesValue = market.status === 'open' && pos.yesShares > 0 ? sellRefund(market, 'YES', pos.yesShares) : 0
  const noValue = market.status === 'open' && pos.noShares > 0 ? sellRefund(market, 'NO', pos.noShares) : 0

  return (
    <div className="bg-surface border border-border rounded-lg overflow-hidden">
      <Confetti trigger={burst} />
      <div className="flex border-b border-border">
        {(['buy', 'sell'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => {
              setTab(t)
              setAmount('')
            }}
            className={`flex-1 py-3 text-sm font-semibold transition-colors ${
              tab === t ? 'text-text border-b-2 border-accent bg-accent/10' : 'text-text-muted hover:text-text'
            }`}
          >
            {t === 'buy' ? '購入' : '売却'}
          </button>
        ))}
      </div>

      <div className="p-4 space-y-4">
        {!canTrade && (
          <div className="text-center py-4 text-text-muted text-sm">
            {market.status === 'pending' && '承認待ちのためトレード不可'}
            {market.status === 'closed' && '締切済み・解決待ち'}
            {market.status === 'resolved' && `解決済み: ${market.resolved}`}
          </div>
        )}

        {canTrade && (
          <>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setSide('YES')
                  setAmount('')
                }}
                className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition-colors border ${
                  side === 'YES'
                    ? 'bg-yes/20 border-yes/60 text-yes'
                    : 'border-border text-text-muted hover:border-yes/30 hover:text-yes'
                }`}
              >
                YES {Math.round(price.yes * 100)}%
              </button>
              <button
                onClick={() => {
                  setSide('NO')
                  setAmount('')
                }}
                className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition-colors border ${
                  side === 'NO'
                    ? 'bg-no/20 border-no/60 text-no'
                    : 'border-border text-text-muted hover:border-no/30 hover:text-no'
                }`}
              >
                NO {Math.round(price.no * 100)}%
              </button>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs text-text-muted">
                  {tab === 'buy' ? (inputMode === 'points' ? 'ポイント額' : 'シェア数') : 'シェア数'}
                </label>
                {tab === 'buy' && (
                  <button
                    onClick={() => {
                      setInputMode(inputMode === 'points' ? 'shares' : 'points')
                      setAmount('')
                    }}
                    className="text-xs text-accent hover:text-accent-hover"
                  >
                    {inputMode === 'points' ? 'シェア数で入力' : 'ポイントで入力'}
                  </button>
                )}
              </div>
              <input
                type="number"
                inputMode="decimal"
                min={0}
                step={sliderStep}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder={tab === 'buy' ? (inputMode === 'points' ? '100' : '1.00') : '1.00'}
                className="w-full px-4 py-3 bg-surface-hover border border-border focus:border-accent rounded-lg text-text text-base outline-none transition-colors placeholder-text-muted"
              />

              {/* スライダー */}
              {sliderMax > 0 && (
                <input
                  type="range"
                  min={0}
                  max={sliderMax}
                  step={sliderStep}
                  value={Math.min(amtNum, sliderMax)}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full mt-3 accent-accent cursor-pointer"
                />
              )}

              {/* クイック％ */}
              <div className="flex gap-1.5 mt-2">
                {QUICK.map((p) => (
                  <button
                    key={p}
                    onClick={() => setPct(p)}
                    disabled={sliderMax <= 0}
                    className="flex-1 py-1 rounded-md bg-surface-hover border border-border text-xs text-text-muted hover:text-text hover:border-accent/40 disabled:opacity-40 transition-colors"
                  >
                    {p === 1 ? 'MAX' : `${p * 100}%`}
                  </button>
                ))}
              </div>

              {user && tab === 'buy' && (
                <p className="text-xs text-text-muted mt-2">残高: {user.points.toLocaleString()} pt</p>
              )}
              {tab === 'sell' && (
                <p className="text-xs text-text-muted mt-2">
                  保有: {held.toFixed(2)} {side} シェア
                </p>
              )}
            </div>

            {pv && !notEnoughShares && (
              <div className="bg-surface-hover rounded-lg p-3 space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-text-muted">取引シェア数</span>
                  <span className="text-text font-medium">{pv.shares.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-text-muted">平均単価</span>
                  <span className="text-text font-medium">{(pv.pricePerShare * 100).toFixed(1)}¢</span>
                </div>
                <div className="flex justify-between text-xs border-t border-border pt-2">
                  <span className="text-text-muted">{tab === 'buy' ? '支払い' : '受取'}</span>
                  <span className={`font-semibold ${tab === 'buy' ? 'text-no' : 'text-yes'}`}>
                    {tab === 'buy' ? '-' : '+'}
                    {pv.cost.toFixed(2)} pt
                  </span>
                </div>
                {tab === 'buy' && (
                  <>
                    <div className="flex justify-between text-xs">
                      <span className="text-text-muted">的中時の受取</span>
                      <span className="text-text font-medium">{payout.toFixed(2)} pt</span>
                    </div>
                    <div className="flex justify-between text-xs border-t border-border pt-2">
                      <span className="text-text-muted">想定リターン（的中時）</span>
                      <span className="text-yes font-bold">
                        +{profit.toFixed(2)} pt（+{roi.toFixed(0)}%）
                      </span>
                    </div>
                  </>
                )}
              </div>
            )}

            {notEnoughShares && (
              <p className="flex items-center justify-center gap-1 text-xs text-no">
                <AlertTriangle size={12} />
                保有シェア数が不足しています
              </p>
            )}

            {!user ? (
              <div className="text-center py-2 text-sm text-text-muted">トレードするにはログインしてください</div>
            ) : (
              <button
                onClick={handleExecute}
                disabled={!pv || insufficient || notEnoughShares || amtNum <= 0}
                className={`w-full py-3 rounded-lg text-sm font-bold transition-colors ${
                  side === 'YES'
                    ? 'bg-yes hover:bg-yes/90 disabled:bg-yes/30 disabled:text-yes/50'
                    : 'bg-no hover:bg-no/90 disabled:bg-no/30 disabled:text-no/50'
                } text-white disabled:cursor-not-allowed`}
              >
                {insufficient ? '残高不足' : tab === 'buy' ? `${side} を購入` : `${side} を売却`}
              </button>
            )}

            {result && (
              <div
                className={`flex items-center justify-center gap-1.5 text-sm py-2 rounded-lg ${
                  result.success ? 'bg-yes/15 text-yes' : 'bg-no/15 text-no'
                }`}
              >
                {result.success ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />}
                {result.message}
              </div>
            )}
          </>
        )}
      </div>

      {(pos.yesShares > 0 || pos.noShares > 0) && (
        <div className="border-t border-border px-4 py-3">
          <p className="text-xs text-text-muted mb-2">保有ポジション</p>
          <div className="space-y-1.5">
            {pos.yesShares > 0 && (
              <div className="flex items-center justify-between text-xs">
                <span className="text-yes font-medium">{pos.yesShares.toFixed(2)} YES</span>
                {market.status === 'open' && <span className="text-text-muted">現在価値 {yesValue.toFixed(1)} pt</span>}
              </div>
            )}
            {pos.noShares > 0 && (
              <div className="flex items-center justify-between text-xs">
                <span className="text-no font-medium">{pos.noShares.toFixed(2)} NO</span>
                {market.status === 'open' && <span className="text-text-muted">現在価値 {noValue.toFixed(1)} pt</span>}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
