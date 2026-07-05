import { useState } from 'react'
import { Area, AreaChart, ResponsiveContainer, YAxis } from 'recharts'
import { usePriceHistory } from '../hooks/usePriceHistory'
import { marketPrice } from '../lib/lmsr'
import type { Market } from '../types'
import { useT } from '../lib/i18n'

const RANGES = [
  { key: '1M', label: '1分', ms: 60_000 },
  { key: '5M', label: '5分', ms: 300_000 },
  { key: '15M', label: '15分', ms: 900_000 },
  { key: '1H', label: '1時間', ms: 3_600_000 },
] as const
type RangeKey = (typeof RANGES)[number]['key']

// 注目カルーセル用の軽量チャート。実データ(price_history)を購読し、
// 取引がなくても現在値で水平線を描画する（フェイクの動きは出さない）。
export default function MiniPriceChart({
  market,
  height = 180,
  interactive = false,
}: {
  market: Market
  height?: number
  interactive?: boolean
}) {
  const t = useT()
  const points = usePriceHistory(market.id)
  const cur = marketPrice(market).yes
  const [range, setRange] = useState<RangeKey>('1H')

  const cfg = RANGES.find((r) => r.key === range)!
  // 最新点を基準に選択した時間幅でフィルタ
  const anchor = points.length ? new Date(points[points.length - 1].t).getTime() : Date.now()
  const filtered = points.filter((p) => anchor - new Date(p.t).getTime() <= cfg.ms)

  const data =
    filtered.length >= 2
      ? filtered.map((p) => ({ yes: p.yes }))
      : filtered.length === 1
      ? [{ yes: filtered[0].yes }, { yes: filtered[0].yes }]
      : [{ yes: cur }, { yes: cur }]

  const yes = '#27AE60'

  return (
    <div className="relative w-full bg-surface-hover" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 0, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="featGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={yes} stopOpacity={0.35} />
              <stop offset="95%" stopColor={yes} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <YAxis domain={[0, 1]} hide />
          <Area
            type="monotone"
            dataKey="yes"
            stroke={yes}
            strokeWidth={2}
            fill="url(#featGrad)"
            dot={false}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>

      {interactive && (
        <div className="absolute right-3 top-3 flex gap-0.5 rounded-md border border-border bg-bg/70 p-0.5 backdrop-blur">
          {RANGES.map((r) => (
            <button
              key={r.key}
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                setRange(r.key)
              }}
              className={`rounded px-1.5 py-0.5 text-[10px] font-medium transition-colors ${
                range === r.key ? 'bg-accent text-white' : 'text-text-muted hover:text-text'
              }`}
            >
              {t(r.label)}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
