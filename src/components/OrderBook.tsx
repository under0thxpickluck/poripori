import { marketPrice } from '../lib/lmsr'
import type { Market } from '../types'
import { useT } from '../lib/i18n'

const DEPTH = 6

// LMSRの数式から、各価格(¢)に到達するまでに必要な累積シェア数を算出（実データ）
export default function OrderBook({ market }: { market: Market }) {
  const t = useT()
  const { q_yes, q_no, b } = market
  const mid = Math.min(99, Math.max(1, Math.round(marketPrice(market).yes * 100)))

  // YES価格を c¢ まで押し上げるのに必要な累積YESシェア
  const cumYes = (c: number) => {
    const p = c / 100
    const target = q_no - b * Math.log(1 / p - 1)
    return Math.max(0, target - q_yes)
  }
  // YES価格を c¢ まで押し下げる（=NOを買う）のに必要な累積NOシェア
  const cumNo = (c: number) => {
    const p = c / 100
    const target = q_yes + b * Math.log(1 / p - 1)
    return Math.max(0, target - q_no)
  }

  // asks: mid より上（YESの売り圧 = ここまで上げるのに必要なYES枚数）
  const asks = Array.from({ length: DEPTH }, (_, i) => {
    const price = mid + (DEPTH - i)
    return price
  })
    .filter((price) => price <= 99)
    .map((price) => ({ price, size: Math.round(cumYes(price) - cumYes(price - 1)) }))

  // bids: mid より下
  const bids = Array.from({ length: DEPTH }, (_, i) => {
    const price = mid - 1 - i
    return price
  })
    .filter((price) => price >= 1)
    .map((price) => ({ price, size: Math.round(cumNo(price) - cumNo(price + 1)) }))

  const maxSize = Math.max(1, ...asks.map((a) => a.size), ...bids.map((b) => b.size))

  return (
    <div className="bg-surface border border-border rounded-lg p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-text">{t('流動性（板）')}</h2>
        <span className="text-xs text-text-muted">{t('価格 / 必要シェア (YES)')}</span>
      </div>

      <div className="space-y-0.5">
        {asks.map((r) => (
          <div key={`a${r.price}`} className="relative flex items-center justify-between px-2 py-1 text-xs">
            <div
              className="absolute inset-y-0 right-0 bg-no/10 rounded-sm"
              style={{ width: `${(r.size / maxSize) * 100}%` }}
            />
            <span className="relative z-10 font-medium text-no">{r.price}¢</span>
            <span className="relative z-10 text-text-muted">{r.size.toLocaleString()}</span>
          </div>
        ))}

        <div className="flex items-center justify-center py-2 my-1 border-y border-border">
          <span className="text-sm font-bold text-text">{t('現在値')} {mid}¢</span>
        </div>

        {bids.map((r) => (
          <div key={`b${r.price}`} className="relative flex items-center justify-between px-2 py-1 text-xs">
            <div
              className="absolute inset-y-0 right-0 bg-yes/10 rounded-sm"
              style={{ width: `${(r.size / maxSize) * 100}%` }}
            />
            <span className="relative z-10 font-medium text-yes">{r.price}¢</span>
            <span className="relative z-10 text-text-muted">{r.size.toLocaleString()}</span>
          </div>
        ))}
      </div>

      <p className="text-[10px] text-text-muted mt-3">
        {t('※ LMSRの流動性曲線から、各価格に動かすのに必要なシェア数を算出した実データです。')}
      </p>
    </div>
  )
}
