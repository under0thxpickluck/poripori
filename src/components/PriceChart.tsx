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
import { useT } from '../lib/i18n'

type Props = { market: Market; height?: number }

const RANGES = [
  { key: '1M', label: '1分', ms: 60_000 },
  { key: '5M', label: '5分', ms: 300_000 },
  { key: '15M', label: '15分', ms: 900_000 },
  { key: '1H', label: '1時間', ms: 3_600_000 },
] as const
type RangeKey = (typeof RANGES)[number]['key']

function pad(n: number) {
  return String(n).padStart(2, '0')
}
function fmt(iso: string, _range: RangeKey) {
  const d = new Date(iso)
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`
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
  const t = useT()
  const theme = useTheme((s) => s.theme)
  const points = usePriceHistory(market.id)
  const [range, setRange] = useState<RangeKey>('1H')

  const grid = theme === 'light' ? '#E5E7EB' : '#222632'
  const axis = theme === 'light' ? '#6B7280' : '#8A8F98'
  const dotStroke = theme === 'light' ? '#FFFFFF' : '#0E1117'
  const yes = '#27AE60'

  const cfg = RANGES.find((r) => r.key === range)!

  // 最新点を基準に、選択した時間幅でフィルタ（終了済み市場でも直近が見える）
  const anchor = points.length ? new Date(points[points.length - 1].t).getTime() : Date.now()
  const filtered = points.filter((p) => anchor - new Date(p.t).getTime() <= cfg.ms)

  const cur = marketPrice(market).yes
  const empty = filtered.length === 0 // この期間に1点もない
  // 1点しかない場合も、現在値で水平線を引いてハッキリ見せる
  const data =
    filtered.length >= 2
      ? filtered.map((p) => ({ t: fmt(p.t, range), yes: p.yes }))
      : filtered.length === 1
      ? [
          { t: '', yes: filtered[0].yes },
          { t: fmt(filtered[0].t, range), yes: filtered[0].yes },
        ]
      : [
          { t: '', yes: cur },
          { t: '', yes: cur },
        ]

  // 選択範囲での変化
  const change = filtered.length >= 2 ? filtered[filtered.length - 1].yes - filtered[0].yes : 0
  const changePct = Math.round(change * 100)

  return (
    <div>
      <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="text-2xl font-bold text-yes tabular-nums">{Math.round(cur * 100)}%</span>
          {filtered.length >= 2 && (
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
              {t(r.label)}
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

        {empty && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <span className="text-xs text-text-muted bg-surface/70 px-2 py-1 rounded">
              {points.length === 0
                ? t('現在 {n}%（取引が始まると変動します）', { n: Math.round(cur * 100) })
                : t('この期間の取引はありません')}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
