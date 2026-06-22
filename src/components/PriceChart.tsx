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

type Props = { market: Market; height?: number }

function formatTime(iso: string) {
  const d = new Date(iso)
  return d.toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' })
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-surface-hover border border-border rounded-lg px-3 py-2">
        <p className="text-xs text-text-muted mb-1">{label}</p>
        <p className="text-sm font-semibold text-yes">
          YES {Math.round(payload[0].value * 100)}%
        </p>
        <p className="text-sm font-semibold text-no">
          NO {Math.round((1 - payload[0].value) * 100)}%
        </p>
      </div>
    )
  }
  return null
}

// データが乏しいマーケットでも線が描けるよう補完する
function buildSeries(market: Market) {
  const pts = market.priceHistory ?? []
  if (pts.length >= 2) return pts.map((p) => ({ t: formatTime(p.t), yes: p.yes }))

  const end = marketPrice(market).yes
  const start = 0.5
  const created = new Date(market.createdAt).getTime()
  const now = Date.now()
  const steps = 8
  return Array.from({ length: steps + 1 }, (_, i) => {
    const r = i / steps
    return {
      t: formatTime(new Date(created + (now - created) * r).toISOString()),
      yes: start + (end - start) * r,
    }
  })
}

export default function PriceChart({ market, height = 200 }: Props) {
  const theme = useTheme((s) => s.theme)
  const grid = theme === 'light' ? '#E5E7EB' : '#222632'
  const axis = theme === 'light' ? '#6B7280' : '#8A8F98'
  const dotStroke = theme === 'light' ? '#FFFFFF' : '#0E1117'
  const yes = '#27AE60'

  const data = buildSeries(market)

  return (
    <div style={{ height }}>
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
            activeDot={{ r: 4, fill: yes, stroke: dotStroke, strokeWidth: 2 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
