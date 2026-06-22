import { marketPrice } from '../lib/lmsr'
import type { Market } from '../types'

// マーケットIDとレベルから安定した擬似サイズを生成（仮データ）
function pseudoSize(seed: string, level: number) {
  let h = 0
  const s = `${seed}:${level}`
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) >>> 0
  }
  return 20 + (h % 380) // 20〜400 シェア
}

const DEPTH = 6

export default function OrderBook({ market }: { market: Market }) {
  const mid = Math.min(99, Math.max(1, Math.round(marketPrice(market).yes * 100)))

  // asks: mid+1 以上（YESの売り板）、bids: mid-1 以下（YESの買い板）
  const asks = Array.from({ length: DEPTH }, (_, i) => {
    const price = mid + (DEPTH - i)
    return { price, size: pseudoSize(market.id + 'a', price) }
  }).filter((r) => r.price <= 99)

  const bids = Array.from({ length: DEPTH }, (_, i) => {
    const price = mid - 1 - i
    return { price, size: pseudoSize(market.id + 'b', price) }
  }).filter((r) => r.price >= 1)

  const maxSize = Math.max(1, ...asks.map((a) => a.size), ...bids.map((b) => b.size))

  return (
    <div className="bg-surface border border-border rounded-lg p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-text">ポジション板</h2>
        <span className="text-xs text-text-muted">価格 / シェア (YES)</span>
      </div>

      <div className="space-y-0.5">
        {asks.map((r) => (
          <div key={`a${r.price}`} className="relative flex items-center justify-between px-2 py-1 text-xs">
            <div
              className="absolute inset-y-0 right-0 bg-no/10 rounded-sm"
              style={{ width: `${(r.size / maxSize) * 100}%` }}
            />
            <span className="relative z-10 font-medium text-no">{r.price}¢</span>
            <span className="relative z-10 text-text-muted">{r.size}</span>
          </div>
        ))}

        <div className="flex items-center justify-center py-2 my-1 border-y border-border">
          <span className="text-sm font-bold text-text">仲値 {mid}¢</span>
        </div>

        {bids.map((r) => (
          <div key={`b${r.price}`} className="relative flex items-center justify-between px-2 py-1 text-xs">
            <div
              className="absolute inset-y-0 right-0 bg-yes/10 rounded-sm"
              style={{ width: `${(r.size / maxSize) * 100}%` }}
            />
            <span className="relative z-10 font-medium text-yes">{r.price}¢</span>
            <span className="relative z-10 text-text-muted">{r.size}</span>
          </div>
        ))}
      </div>

      <p className="text-[10px] text-text-muted mt-3">※ LMSR方式のため板は流動性からの参考表示（仮）です。</p>
    </div>
  )
}
