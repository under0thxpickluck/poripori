import { useState } from 'react'
import { Search } from 'lucide-react'
import { useStore } from '../store/useStore'
import MarketCard from '../components/MarketCard'
import type { Category } from '../types'

const CATEGORIES: Category[] = ['All', 'Politics', 'Crypto', 'Sports', 'AI', 'Tech', 'Science', 'Entertainment']

const CAT_LABELS: Record<Category, string> = {
  All: 'すべて',
  Politics: '政治',
  Crypto: '暗号資産',
  Sports: 'スポーツ',
  AI: 'AI',
  Tech: 'テクノロジー',
  Science: '科学',
  Entertainment: 'エンタメ',
}

export default function MarketList() {
  const { markets } = useStore()
  const [cat, setCat] = useState<Category>('All')
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<'open' | 'closed' | 'resolved' | 'all'>('open')

  const open = markets.filter((m) => {
    if (statusFilter !== 'all' && m.status !== statusFilter) return false
    if (m.status === 'pending') return false
    if (cat !== 'All' && m.category !== cat) return false
    if (query && !m.question.toLowerCase().includes(query.toLowerCase())) return false
    return true
  })

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white mb-1">予測市場</h1>
        <p className="text-slate-400 text-sm">結果を予測してポイントを稼ごう</p>
      </div>

      <div className="relative mb-4">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
        <input
          type="text"
          placeholder="マーケットを検索..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full pl-9 pr-4 py-2.5 bg-[#13162d] border border-[#2a2d4a] focus:border-indigo-500 rounded-xl text-sm text-white placeholder-slate-500 outline-none transition-colors"
        />
      </div>

      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <div className="flex gap-1 p-1 bg-[#13162d] border border-[#2a2d4a] rounded-xl">
          {(['open', 'closed', 'resolved', 'all'] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                statusFilter === s
                  ? 'bg-indigo-600 text-white'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {s === 'open' ? '受付中' : s === 'closed' ? '締切済み' : s === 'resolved' ? '解決済み' : 'すべて'}
            </button>
          ))}
        </div>
      </div>

      <div className="flex gap-2 mb-6 overflow-x-auto pb-1 scrollbar-none">
        {CATEGORIES.map((c) => (
          <button
            key={c}
            onClick={() => setCat(c)}
            className={`shrink-0 px-4 py-1.5 rounded-full text-sm font-medium transition-colors border ${
              cat === c
                ? 'bg-indigo-600/20 border-indigo-500/60 text-indigo-400'
                : 'border-[#2a2d4a] text-slate-400 hover:text-white hover:border-slate-500'
            }`}
          >
            {CAT_LABELS[c]}
          </button>
        ))}
      </div>

      {open.length === 0 ? (
        <div className="text-center py-20 text-slate-500">
          <p className="text-lg">マーケットが見つかりません</p>
          <p className="text-sm mt-1">別のカテゴリやキーワードで検索してみてください</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {open.map((m) => (
            <MarketCard key={m.id} market={m} />
          ))}
        </div>
      )}
    </div>
  )
}
