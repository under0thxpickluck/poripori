import { Link } from 'react-router-dom'
import { BarChart3, Users, TrendingUp, Clock, CheckCircle2, MessageSquare } from 'lucide-react'
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { useStore } from '../../store/useStore'
import { marketPrice } from '../../lib/lmsr'
import { useTheme } from '../../store/useTheme'
import CountUp from '../../components/CountUp'

const CAT_COLOR: Record<string, string> = {
  Politics: '#60a5fa',
  Crypto: '#fb923c',
  Sports: '#4ade80',
  AI: '#c084fc',
  Tech: '#22d3ee',
  Science: '#38bdf8',
  Entertainment: '#f472b6',
}

export default function Dashboard() {
  const { markets, users, comments, currentUser } = useStore()
  const theme = useTheme((s) => s.theme)
  const user = currentUser()
  if (user?.role !== 'admin') {
    return <div className="text-center py-20 text-no">管理者権限が必要です</div>
  }

  const axis = theme === 'light' ? '#6B7280' : '#8A8F98'
  const totalVolume = markets.reduce((s, m) => s + m.volume, 0)
  const pending = markets.filter((m) => m.status === 'pending').length
  const resolved = markets.filter((m) => m.status === 'resolved').length

  const stats = [
    { label: '総マーケット数', value: markets.length, suffix: '', Icon: BarChart3 },
    { label: '総ユーザー数', value: users.length, suffix: '', Icon: Users },
    { label: '総出来高', value: totalVolume, suffix: ' pt', Icon: TrendingUp },
    { label: '承認待ち', value: pending, suffix: '', Icon: Clock },
    { label: '解決済み', value: resolved, suffix: '', Icon: CheckCircle2 },
    { label: 'コメント数', value: comments.length, suffix: '', Icon: MessageSquare },
  ]

  // カテゴリ別出来高
  const catMap = new Map<string, number>()
  markets.forEach((m) => catMap.set(m.category, (catMap.get(m.category) ?? 0) + m.volume))
  const catData = [...catMap.entries()]
    .map(([category, volume]) => ({ category, volume }))
    .sort((a, b) => b.volume - a.volume)

  // ステータス内訳
  const statusData = [
    { name: '受付中', value: markets.filter((m) => m.status === 'open').length, color: '#2D9CDB' },
    { name: '締切', value: markets.filter((m) => m.status === 'closed').length, color: axis },
    { name: '解決済み', value: resolved, color: '#27AE60' },
    { name: '承認待ち', value: pending, color: '#eab308' },
  ].filter((s) => s.value > 0)

  const topMarkets = [...markets].sort((a, b) => b.volume - a.volume).slice(0, 5)
  const recent = [...markets].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 5)

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-text">管理ダッシュボード</h1>

      {/* KPI */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
        {stats.map(({ label, value, suffix, Icon }) => (
          <div key={label} className="bg-surface border border-border rounded-lg p-4">
            <Icon size={18} className="text-accent mb-2" />
            <div className="text-2xl font-bold text-text">
              <CountUp value={value} />
              {suffix}
            </div>
            <div className="text-xs text-text-muted mt-1">{label}</div>
          </div>
        ))}
      </div>

      {/* チャート2枚 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-surface border border-border rounded-lg p-5">
          <h2 className="text-sm font-semibold text-text mb-4">カテゴリ別 出来高</h2>
          <div style={{ height: 240 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={catData} layout="vertical" margin={{ top: 0, right: 16, left: 8, bottom: 0 }}>
                <XAxis type="number" tick={{ fill: axis, fontSize: 11 }} tickLine={false} axisLine={false} />
                <YAxis
                  type="category"
                  dataKey="category"
                  width={90}
                  tick={{ fill: axis, fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip
                  cursor={{ fill: 'rgb(var(--c-surface-hover))' }}
                  contentStyle={{
                    background: 'rgb(var(--c-surface-hover))',
                    border: '1px solid rgb(var(--c-border))',
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                  formatter={(v: number) => [`${v.toLocaleString()} pt`, '出来高']}
                />
                <Bar dataKey="volume" radius={[0, 4, 4, 0]}>
                  {catData.map((d) => (
                    <Cell key={d.category} fill={CAT_COLOR[d.category] ?? '#2D9CDB'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-surface border border-border rounded-lg p-5">
          <h2 className="text-sm font-semibold text-text mb-4">ステータス内訳</h2>
          <div style={{ height: 240 }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={statusData} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80} paddingAngle={2}>
                  {statusData.map((s) => (
                    <Cell key={s.name} fill={s.color} stroke="none" />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    background: 'rgb(var(--c-surface-hover))',
                    border: '1px solid rgb(var(--c-border))',
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 justify-center">
            {statusData.map((s) => (
              <span key={s.name} className="flex items-center gap-1.5 text-xs text-text-muted">
                <span className="w-2.5 h-2.5 rounded-sm" style={{ background: s.color }} />
                {s.name} {s.value}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* トップ＆最近 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-surface border border-border rounded-lg p-4">
          <h2 className="text-sm font-semibold text-text mb-3">出来高トップ</h2>
          <div className="space-y-2">
            {topMarkets.map((m, i) => (
              <Link
                key={m.id}
                to={`/market/${m.id}`}
                className="flex items-center gap-3 bg-surface-hover rounded-md p-3 hover:border-accent/40 border border-transparent transition-colors"
              >
                <span className="text-xs font-bold text-text-muted w-4">{i + 1}</span>
                <p className="text-sm font-medium text-text line-clamp-1 flex-1">{m.question}</p>
                <span className="text-xs font-semibold text-accent shrink-0">{m.volume.toLocaleString()} pt</span>
              </Link>
            ))}
          </div>
        </div>

        <div className="bg-surface border border-border rounded-lg p-4">
          <h2 className="text-sm font-semibold text-text mb-3">最近のマーケット</h2>
          <div className="space-y-2">
            {recent.map((m) => (
              <div key={m.id} className="flex items-center gap-3 bg-surface-hover rounded-md p-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-text line-clamp-1">{m.question}</p>
                  <p className="text-xs text-text-muted">
                    {m.category} ・ {m.status} ・ YES {Math.round(marketPrice(m).yes * 100)}%
                  </p>
                </div>
                <Link to="/admin/markets" className="text-xs text-accent hover:underline shrink-0">
                  管理
                </Link>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
