import { Link } from 'react-router-dom'
import { BarChart3, Users, TrendingUp, Clock } from 'lucide-react'
import { useStore } from '../../store/useStore'
import { marketPrice } from '../../lib/lmsr'
import CountUp from '../../components/CountUp'

export default function Dashboard() {
  const { markets, users, currentUser } = useStore()
  const user = currentUser()
  if (user?.role !== 'admin') {
    return <div className="text-center py-20 text-no">管理者権限が必要です</div>
  }

  const totalVolume = markets.reduce((s, m) => s + m.volume, 0)
  const pending = markets.filter((m) => m.status === 'pending').length
  const stats = [
    { label: '総マーケット数', value: markets.length, suffix: '', Icon: BarChart3 },
    { label: '総ユーザー数', value: users.length, suffix: '', Icon: Users },
    { label: '総出来高', value: totalVolume, suffix: ' pt', Icon: TrendingUp },
    { label: '承認待ち', value: pending, suffix: '', Icon: Clock },
  ]
  const recent = [...markets].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 5)

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-text">管理ダッシュボード</h1>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
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
              <Link to="/admin/markets" className="text-xs text-accent hover:underline shrink-0">管理</Link>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
