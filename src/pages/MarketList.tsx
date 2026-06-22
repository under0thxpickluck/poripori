import { useState } from 'react'
import type React from 'react'
import { Search } from 'lucide-react'
import { useStore } from '../store/useStore'
import MarketCard from '../components/MarketCard'
import AdCard from '../components/AdCard'
import type { Category } from '../types'

const CATEGORIES: Category[] = ['All', 'Politics', 'Crypto', 'Sports', 'AI', 'Tech', 'Science', 'Entertainment']

const AD_INTERVAL = 6

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

const TRENDING_TOPICS = [
  '選挙',
  'AGI',
  'ビットコイン',
  'ワールドカップ',
  'OpenAI',
  '株価',
  '金利',
  '宇宙',
]

export default function MarketList() {
  const { markets, ads } = useStore()
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

  const isDefaultView = cat === 'All' && !query && statusFilter === 'open'
  const featured = isDefaultView ? [...open].sort((a, b) => b.volume - a.volume).slice(0, 3) : []
  const featuredIds = new Set(featured.map((m) => m.id))
  const rest = open.filter((m) => !featuredIds.has(m.id))

  const activeAds = ads.filter((a) => a.active)

  function toggleTopic(topic: string) {
    setQuery((q) => (q === topic ? '' : topic))
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-text mb-1">予測市場</h1>
      </div>

      <div className="relative mb-5">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
        <input
          type="text"
          placeholder="マーケットを検索..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full pl-9 pr-4 py-2.5 bg-surface border border-border focus:border-accent rounded-lg text-sm text-text placeholder-text-muted outline-none transition-colors"
        />
      </div>

      <div className="mb-6">
        <h2 className="text-xs font-semibold text-text-muted mb-2">注目のトピック</h2>
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
          {TRENDING_TOPICS.map((topic) => (
            <button
              key={topic}
              onClick={() => toggleTopic(topic)}
              className={`shrink-0 px-3 py-1.5 rounded-full text-sm font-medium transition-colors border ${
                query === topic
                  ? 'bg-accent/20 border-accent/60 text-accent'
                  : 'bg-surface border-border text-text-muted hover:text-text hover:border-accent/40'
              }`}
            >
              {topic}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <div className="flex gap-1 p-1 bg-surface border border-border rounded-lg">
          {(['open', 'closed', 'resolved', 'all'] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                statusFilter === s
                  ? 'bg-accent text-white'
                  : 'text-text-muted hover:text-text'
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
                ? 'bg-accent/20 border-accent/60 text-accent'
                : 'border-border text-text-muted hover:text-text hover:border-border'
            }`}
          >
            {CAT_LABELS[c]}
          </button>
        ))}
      </div>

      {featured.length > 0 && (
        <div className="mb-8">
          <h2 className="text-lg font-bold text-text mb-3">注目のマーケット</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {featured.map((m) => (
              <MarketCard key={m.id} market={m} />
            ))}
          </div>
        </div>
      )}

      {open.length === 0 ? (
        <div className="text-center py-20 text-text-muted">
          <p className="text-lg">マーケットが見つかりません</p>
          <p className="text-sm mt-1">別のカテゴリやキーワードで検索してみてください</p>
        </div>
      ) : rest.length > 0 ? (
        <div>
          <h2 className="text-lg font-bold text-text mb-3">すべてのマーケット</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {(() => {
              const cells: React.ReactNode[] = []
              rest.forEach((m, i) => {
                cells.push(<MarketCard key={m.id} market={m} />)
                if (activeAds.length > 0 && (i + 1) % AD_INTERVAL === 0) {
                  const ad = activeAds[Math.floor(i / AD_INTERVAL) % activeAds.length]
                  cells.push(<AdCard key={`ad-${i}-${ad.id}`} ad={ad} />)
                }
              })
              return cells
            })()}
          </div>
        </div>
      ) : null}
    </div>
  )
}
