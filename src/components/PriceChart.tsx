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

export default function PriceChart({ market, height = 200 }: Props) {
  const data = market.priceHistory.map((p) => ({
    t: formatTime(p.t),
    yes: p.yes,
  }))

  if (data.length < 2) {
    return (
      <div
        className="flex items-center justify-center rounded-lg bg-surface-hover text-text-muted text-sm"
        style={{ height }}
      >
        チャートデータなし
      </div>
    )
  }

  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="yesGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#27AE60" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#27AE60" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="#222632" strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="t"
            tick={{ fill: '#8A8F98', fontSize: 10 }}
            tickLine={false}
            axisLine={false}
            interval="preserveStartEnd"
          />
          <YAxis
            domain={[0, 1]}
            tickFormatter={(v) => `${Math.round(v * 100)}%`}
            tick={{ fill: '#8A8F98', fontSize: 10 }}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip content={<CustomTooltip />} />
          <Area
            type="monotone"
            dataKey="yes"
            stroke="#27AE60"
            strokeWidth={2}
            fill="url(#yesGradient)"
            dot={false}
            activeDot={{ r: 4, fill: '#27AE60', stroke: '#0E1117', strokeWidth: 2 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
