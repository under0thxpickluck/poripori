import { useState } from 'react'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import type { Market } from '../types'
import { marketPrice } from '../lib/lmsr'
import { useTheme } from '../store/useTheme'
import { usePriceHistory } from '../hooks/usePriceHistory'

type Props = { market: Market; height?: number }

const RANGES = [
  { key: '1H', label: '1時間', ms: 3_600_000 },
  { key: '1D', label: '1日', ms: 86_400_000 },
  { key: '1W', label: '1週間', ms: 604_800_000 },
  { key: 'ALL', label: '全期間', ms: Infinity },
] as const
type RangeKey = (typeof RANGES)[number]['key']

function pad(n: number) {
  return String(n).padStart(2, '0')
}
function fmt(iso: string, range: RangeKey) {
  const d = new Date(iso)
  if (range === '1H' || range === '1D') return `${pad(d.getHours())}:${pad(d.getMinutes())}`
  return `${d.getMonth() + 1}/${d.getDate()}`
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-surface-hover border border-border rounded-lg px-3 py-2">
        <p className="text-xs text-text-muted mb-1">{label}</p>
        <p className="text-sm font-semibold text-yes">YES {Math.round(payload[0].value * 100)}%</p>
        <p className="text-sm font-semibold text-no">NO {Math.round((1 - payload[0].value) * 100)}%</p>
      </div>
    )
  }
  return null
}

export default function PriceChart({ market, height = 200 }: Props) {
  const theme = useTheme((s) => s.theme)
  const points = usePriceHistory(market.id)
  const [range, setRange] = useState<RangeKey>('ALL')

  const grid = theme === 'light' ? '#E5E7EB' : '#222632'
  const axis = theme === 'light' ? '#6B7280' : '#8A8F98'
  const dotStroke = theme === 'light' ? '#FFFFFF' : '#0E1117'
  const yes = '#27AE60'

  const cfg = RANGES.find((r) => r.key === range)!

  // 最新点を基準に、選択した時間幅でフィルタ（終了済み市場でも直近が見える）
  const anchor = points.length ? new Date(points[points.length - 1].t).getTime() : Date.now()
  const filtered =
    cfg.ms === Infinity
      ? points
      : points.filter((p) => anchor - new Date(p.t).getTime() <= cfg.ms)

  const hasData = filtered.length >= 2
  const cur = marketPrice(market).yes
  const data = hasData
    ? filtered.map((p) => ({ t: fmt(p.t, range), yes: p.yes }))
    : [
        { t: '', yes: cur },
        { t: '', yes: cur },
      ]

  // 選択範囲での変化
  const change = hasData ? filtered[filtered.length - 1].yes - filtered[0].yes : 0
  const changePct = Math.round(change * 100)

  return (
    <div>
      <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="text-2xl font-bold text-yes tabular-nums">{Math.round(cur * 100)}%</span>
          {hasData && (
            <span
              className={`text-xs font-semibold tabular-nums ${
                changePct >= 0 ? 'text-yes' : 'text-no'
              }`}
            >
              {changePct >= 0 ? '+' : ''}
              {changePct}pt
            </span>
          )}
          <span className="flex items-center gap-1 text-[10px] font-bold tracking-wide text-text-muted">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full rounded-full bg-yes opacity-60 animate-ping" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-yes" />
            </span>
            LIVE
          </span>
        </div>
        <div className="flex gap-1 p-0.5 bg-surface-hover border border-border rounded-lg">
          {RANGES.map((r) => (
            <button
              key={r.key}
              onClick={() => setRange(r.key)}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                range === r.key ? 'bg-accent text-white' : 'text-text-muted hover:text-text'
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ height }} className="relative">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="yesGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={yes} stopOpacity={0.3} />
                <stop offset="95%" stopColor={yes} stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke={grid} strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="t"
              tick={{ fill: axis, fontSize: 10 }}
              tickLine={false}
              axisLine={false}
              interval="preserveStartEnd"
              minTickGap={28}
            />
            <YAxis
              domain={[0, 1]}
              tickFormatter={(v) => `${Math.round(v * 100)}%`}
              tick={{ fill: axis, fontSize: 10 }}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip content={<CustomTooltip />} />
            <Area
              type="monotone"
              dataKey="yes"
              stroke={yes}
              strokeWidth={2}
              fill="url(#yesGradient)"
              dot={false}
              isAnimationActive={false}
              activeDot={{ r: 4, fill: yes, stroke: dotStroke, strokeWidth: 2 }}
            />
          </AreaChart>
        </ResponsiveContainer>

        {!hasData && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <span className="text-xs text-text-muted bg-surface/70 px-2 py-1 rounded">
              {range === 'ALL' ? 'まだ取引がありません' : 'この期間の取引はありません'}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
