import { useState, useCallback } from 'react'
import { useStore } from '../store/useStore'
import { buyCost, sellRefund, sharesForPoints, marketPrice } from '../lib/lmsr'
import type { Market } from '../types'

type Tab = 'buy' | 'sell'
type Side = 'YES' | 'NO'

type Props = { market: Market }

export default function TradePanel({ market }: Props) {
  const { currentUser, buyShares, sellShares, getPosition } = useStore()
  const user = currentUser()
  const [tab, setTab] = useState<Tab>('buy')
  const [side, setSide] = useState<Side>('YES')
  const [inputMode, setInputMode] = useState<'points' | 'shares'>('points')
  const [amount, setAmount] = useState('')
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null)

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

  function handleMax() {
    if (tab === 'buy') {
      setInputMode('points')
      setAmount(String(Math.floor(user?.points ?? 0)))
    } else {
      setAmount(String(Math.floor(held)))
    }
  }

  function handleExecute() {
    if (!pv || !user) return
    let r
    if (tab === 'buy') {
      r = buyShares(market.id, side, pv.shares)
    } else {
      r = sellShares(market.id, side, pv.shares)
    }
    if (r.success) {
      const msg =
        tab === 'buy'
          ? `✓ ${pv.shares.toFixed(2)} ${side} シェアを購入しました`
          : `✓ ${pv.shares.toFixed(2)} ${side} シェアを売却しました`
      setResult({ success: true, message: msg })
      setAmount('')
    } else {
      setResult({ success: false, message: r.error ?? 'エラーが発生しました' })
    }
    setTimeout(() => setResult(null), 3000)
  }

  const canTrade = market.status === 'open'
  const insufficient = tab === 'buy' && pv != null && user != null && pv.cost > user.points
  const notEnoughShares = tab === 'sell' && amtNum > held

  return (
    <div className="bg-[#13162d] border border-[#2a2d4a] rounded-2xl overflow-hidden">
      <div className="flex border-b border-[#2a2d4a]">
        {(['buy', 'sell'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => { setTab(t); setAmount('') }}
            className={`flex-1 py-3 text-sm font-semibold transition-colors ${
              tab === t
                ? 'text-white border-b-2 border-indigo-500 bg-indigo-500/10'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            {t === 'buy' ? '購入' : '売却'}
          </button>
        ))}
      </div>

      <div className="p-4 space-y-4">
        {!canTrade && (
          <div className="text-center py-4 text-slate-400 text-sm">
            {market.status === 'pending' && '承認待ちのためトレード不可'}
            {market.status === 'closed' && '締切済み・解決待ち'}
            {market.status === 'resolved' && `解決済み: ${market.resolved}`}
          </div>
        )}

        {canTrade && (
          <>
            <div className="flex gap-2">
              <button
                onClick={() => { setSide('YES'); setAmount('') }}
                className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all border ${
                  side === 'YES'
                    ? 'bg-emerald-500/20 border-emerald-500/60 text-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.15)]'
                    : 'border-[#2a2d4a] text-slate-400 hover:border-emerald-500/30 hover:text-emerald-400'
                }`}
              >
                YES {Math.round(price.yes * 100)}%
              </button>
              <button
                onClick={() => { setSide('NO'); setAmount('') }}
                className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all border ${
                  side === 'NO'
                    ? 'bg-red-500/20 border-red-500/60 text-red-400 shadow-[0_0_12px_rgba(239,68,68,0.15)]'
                    : 'border-[#2a2d4a] text-slate-400 hover:border-red-500/30 hover:text-red-400'
                }`}
              >
                NO {Math.round(price.no * 100)}%
              </button>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs text-slate-400">
                  {tab === 'buy'
                    ? inputMode === 'points'
                      ? 'ポイント額'
                      : 'シェア数'
                    : 'シェア数'}
                </label>
                <div className="flex items-center gap-2">
                  {tab === 'buy' && (
                    <button
                      onClick={() => setInputMode(inputMode === 'points' ? 'shares' : 'points')}
                      className="text-xs text-indigo-400 hover:text-indigo-300"
                    >
                      {inputMode === 'points' ? 'シェア数で入力' : 'ポイントで入力'}
                    </button>
                  )}
                  <button onClick={handleMax} className="text-xs text-indigo-400 hover:text-indigo-300">
                    MAX
                  </button>
                </div>
              </div>
              <input
                type="number"
                min={0}
                step={tab === 'buy' && inputMode === 'shares' ? 0.01 : 1}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder={tab === 'buy' ? (inputMode === 'points' ? '100' : '1.00') : '1.00'}
                className="w-full px-4 py-2.5 bg-[#1e2244] border border-[#2a2d4a] focus:border-indigo-500 rounded-xl text-white text-sm outline-none transition-colors placeholder-slate-600"
              />
              {user && tab === 'buy' && (
                <p className="text-xs text-slate-500 mt-1">
                  残高: {user.points.toLocaleString()} pt
                </p>
              )}
              {tab === 'sell' && (
                <p className="text-xs text-slate-500 mt-1">
                  保有: {held.toFixed(2)} {side} シェア
                </p>
              )}
            </div>

            {pv && !notEnoughShares && (
              <div className="bg-[#1e2244] rounded-xl p-3 space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400">取引シェア数</span>
                  <span className="text-white font-medium">{pv.shares.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400">平均単価</span>
                  <span className="text-white font-medium">{(pv.pricePerShare * 100).toFixed(1)}¢</span>
                </div>
                <div className="flex justify-between text-xs border-t border-[#2a2d4a] pt-2">
                  <span className="text-slate-400">{tab === 'buy' ? '支払い' : '受取'}</span>
                  <span className={`font-semibold ${tab === 'buy' ? 'text-red-400' : 'text-emerald-400'}`}>
                    {tab === 'buy' ? '-' : '+'}{pv.cost.toFixed(2)} pt
                  </span>
                </div>
                {tab === 'buy' && (
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-400">最大利益 (的中時)</span>
                    <span className="text-emerald-400 font-medium">+{pv.shares.toFixed(2)} pt</span>
                  </div>
                )}
              </div>
            )}

            {notEnoughShares && (
              <p className="text-xs text-red-400 text-center">保有シェア数が不足しています</p>
            )}

            {!user ? (
              <div className="text-center py-2 text-sm text-slate-400">
                トレードするにはログインしてください
              </div>
            ) : (
              <button
                onClick={handleExecute}
                disabled={!pv || insufficient || notEnoughShares || amtNum <= 0}
                className={`w-full py-3 rounded-xl text-sm font-bold transition-all ${
                  side === 'YES'
                    ? 'bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-900/40 disabled:text-emerald-700'
                    : 'bg-red-600 hover:bg-red-500 disabled:bg-red-900/40 disabled:text-red-700'
                } text-white disabled:cursor-not-allowed`}
              >
                {tab === 'buy' ? `${side} を購入` : `${side} を売却`}
              </button>
            )}

            {result && (
              <div
                className={`text-sm text-center py-2 rounded-lg ${
                  result.success ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400'
                }`}
              >
                {result.message}
              </div>
            )}
          </>
        )}
      </div>

      {(pos.yesShares > 0 || pos.noShares > 0) && (
        <div className="border-t border-[#2a2d4a] px-4 py-3">
          <p className="text-xs text-slate-400 mb-2">保有ポジション</p>
          <div className="flex gap-3">
            {pos.yesShares > 0 && (
              <div className="text-xs">
                <span className="text-emerald-400 font-medium">{pos.yesShares.toFixed(2)} YES</span>
              </div>
            )}
            {pos.noShares > 0 && (
              <div className="text-xs">
                <span className="text-red-400 font-medium">{pos.noShares.toFixed(2)} NO</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
