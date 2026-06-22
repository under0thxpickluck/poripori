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
      <div className="bg-[#1e2244] border border-[#2a2d4a] rounded-lg px-3 py-2 shadow-xl">
        <p className="text-xs text-slate-400 mb-1">{label}</p>
        <p className="text-sm font-semibold text-emerald-400">
          YES {Math.round(payload[0].value * 100)}%
        </p>
        <p className="text-sm font-semibold text-red-400">
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
        className="flex items-center justify-center rounded-xl bg-[#1e2244] text-slate-500 text-sm"
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
              <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#10b981" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="#1e2244" strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="t"
            tick={{ fill: '#64748b', fontSize: 10 }}
            tickLine={false}
            axisLine={false}
            interval="preserveStartEnd"
          />
          <YAxis
            domain={[0, 1]}
            tickFormatter={(v) => `${Math.round(v * 100)}%`}
            tick={{ fill: '#64748b', fontSize: 10 }}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip content={<CustomTooltip />} />
          <Area
            type="monotone"
            dataKey="yes"
            stroke="#10b981"
            strokeWidth={2}
            fill="url(#yesGradient)"
            dot={false}
            activeDot={{ r: 4, fill: '#10b981', stroke: '#0c0e1a', strokeWidth: 2 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
