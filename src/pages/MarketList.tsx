import { useState } from 'react'
import type React from 'react'
import { Search, Flame, Sparkles, BarChart2, Clock, MessageSquare, SlidersHorizontal, Check } from 'lucide-react'
import { useStore } from '../store/useStore'
import MarketCard from '../components/MarketCard'
import AdCard from '../components/AdCard'
import FeaturedCarousel from '../components/FeaturedCarousel'
import LiveTicker from '../components/LiveTicker'
import BottomSheet from '../components/BottomSheet'
import GameCorner from '../components/GameCorner'
import type { Category, Market } from '../types'
import { useT } from '../lib/i18n'

const STATUS_LABELS: Record<string, string> = {
  open: '受付中',
  closed: '締切済み',
  resolved: '解決済み',
  all: 'すべて',
}

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

type SortKey = 'volume' | 'trending' | 'new' | 'ending' | 'discussed'

const SORTS: { key: SortKey; label: string; Icon: typeof Flame }[] = [
  { key: 'volume', label: '出来高', Icon: BarChart2 },
  { key: 'trending', label: '急上昇', Icon: Flame },
  { key: 'new', label: '新着', Icon: Sparkles },
  { key: 'ending', label: '終了間近', Icon: Clock },
  { key: 'discussed', label: '話題', Icon: MessageSquare },
]

// 直近の価格上昇幅（急上昇の指標）
function momentum(m: Market): number {
  const h = m.priceHistory
  if (!h || h.length < 2) return 0
  const last = h[h.length - 1].yes
  const idx = Math.max(0, h.length - 6)
  return last - h[idx].yes
}

export default function MarketList() {
  const t = useT()
  const { markets, ads, comments } = useStore()
  const [cat, setCat] = useState<Category>('All')
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<'open' | 'closed' | 'resolved' | 'all'>('open')
  const [sort, setSort] = useState<SortKey>('volume')
  const [filterSheet, setFilterSheet] = useState(false)

  const commentCount = (id: string) => comments.filter((c) => c.marketId === id).length

  const filtered = markets.filter((m) => {
    if (statusFilter !== 'all' && m.status !== statusFilter) return false
    if (m.status === 'pending') return false
    if (cat !== 'All' && m.category !== cat) return false
    if (query && !m.question.toLowerCase().includes(query.toLowerCase())) return false
    return true
  })

  const open = [...filtered].sort((a, b) => {
    switch (sort) {
      case 'trending':
        return momentum(b) - momentum(a)
      case 'new':
        return b.createdAt.localeCompare(a.createdAt)
      case 'ending':
        return new Date(a.deadline).getTime() - new Date(b.deadline).getTime()
      case 'discussed':
        return commentCount(b.id) - commentCount(a.id)
      default:
        return b.volume - a.volume
    }
  })

  const isDefaultView = cat === 'All' && !query && statusFilter === 'open' && sort === 'volume'
  const featured = isDefaultView ? open.slice(0, 7) : []
  const featuredIds = new Set(featured.map((m) => m.id))
  const rest = open.filter((m) => !featuredIds.has(m.id))

  const activeAds = ads.filter((a) => a.active)

  function toggleTopic(topic: string) {
    setQuery((q) => (q === topic ? '' : topic))
  }

  const tickerMarkets = [...markets]
    .filter((m) => m.status === 'open')
    .sort((a, b) => b.volume - a.volume)

  return (
    <div>
      <LiveTicker markets={tickerMarkets} />

      <div className="relative mb-5">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
        <input
          type="text"
          placeholder={t('マーケットを検索...')}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full pl-9 pr-4 py-2.5 bg-surface border border-border focus:border-accent rounded-lg text-sm text-text placeholder-text-muted outline-none transition-colors"
        />
      </div>

      <div className="mb-6">
        <h2 className="text-xs font-semibold text-text-muted mb-2">{t('注目のトピック')}</h2>
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

      {/* デスクトップ：インラインのステータス＋ソート */}
      <div className="hidden sm:flex items-center gap-2 mb-4 flex-wrap">
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
              {t(STATUS_LABELS[s])}
            </button>
          ))}
        </div>

        <div className="flex gap-1 p-1 bg-surface border border-border rounded-lg ml-auto overflow-x-auto scrollbar-none">
          {SORTS.map(({ key, label, Icon }) => (
            <button
              key={key}
              onClick={() => setSort(key)}
              className={`flex items-center gap-1 px-3 py-1 rounded-md text-xs font-medium whitespace-nowrap transition-colors ${
                sort === key ? 'bg-accent text-white' : 'text-text-muted hover:text-text'
              }`}
            >
              <Icon size={12} />
              {t(label)}
            </button>
          ))}
        </div>
      </div>

      {/* スマホ：絞り込みをボトムシートに集約 */}
      <button
        onClick={() => setFilterSheet(true)}
        className="sm:hidden flex items-center justify-between w-full mb-4 px-4 py-2.5 bg-surface border border-border rounded-lg text-sm text-text"
      >
        <span className="flex items-center gap-2 font-medium">
          <SlidersHorizontal size={15} className="text-accent" />
          {t('並び替え・絞り込み')}
        </span>
        <span className="text-xs text-text-muted">
          {t(STATUS_LABELS[statusFilter])} ・ {t(SORTS.find((s) => s.key === sort)?.label ?? '')}
        </span>
      </button>

      {filterSheet && (
        <BottomSheet title={t('並び替え・絞り込み')} onClose={() => setFilterSheet(false)}>
          <div className="p-4 space-y-5">
            <div>
              <p className="text-xs font-semibold text-text-muted mb-2">{t('表示するマーケット')}</p>
              <div className="grid grid-cols-2 gap-2">
                {(['open', 'closed', 'resolved', 'all'] as const).map((s) => (
                  <button
                    key={s}
                    onClick={() => setStatusFilter(s)}
                    className={`flex items-center justify-between px-3 py-2.5 rounded-lg border text-sm transition-colors ${
                      statusFilter === s
                        ? 'bg-accent/15 border-accent/60 text-accent font-semibold'
                        : 'border-border text-text-muted'
                    }`}
                  >
                    {t(STATUS_LABELS[s])}
                    {statusFilter === s && <Check size={15} />}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs font-semibold text-text-muted mb-2">{t('並び替え')}</p>
              <div className="grid grid-cols-1 gap-2">
                {SORTS.map(({ key, label, Icon }) => (
                  <button
                    key={key}
                    onClick={() => setSort(key)}
                    className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border text-sm transition-colors ${
                      sort === key
                        ? 'bg-accent/15 border-accent/60 text-accent font-semibold'
                        : 'border-border text-text-muted'
                    }`}
                  >
                    <Icon size={15} />
                    {t(label)}
                    {sort === key && <Check size={15} className="ml-auto" />}
                  </button>
                ))}
              </div>
            </div>
            <button
              onClick={() => setFilterSheet(false)}
              className="w-full py-3 rounded-lg bg-accent text-white text-sm font-semibold"
            >
              {t('この条件で表示')}
            </button>
          </div>
        </BottomSheet>
      )}

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
            {t(CAT_LABELS[c])}
          </button>
        ))}
      </div>

      {featured.length > 0 && <FeaturedCarousel markets={featured} />}
      {isDefaultView && <GameCorner />}

      {open.length === 0 ? (
        <div className="text-center py-20 text-text-muted">
          <p className="text-lg">{t('マーケットが見つかりません')}</p>
          <p className="text-sm mt-1">{t('別のカテゴリやキーワードで検索してみてください')}</p>
        </div>
      ) : rest.length > 0 ? (
        <div>
          <h2 className="text-lg font-bold text-text mb-3">
            {sort === 'volume'
              ? t('すべてのマーケット')
              : t('{s}のマーケット', { s: t(SORTS.find((s) => s.key === sort)?.label ?? '') })}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {(() => {
              const cells: React.ReactNode[] = []
              rest.forEach((m, i) => {
                cells.push(
                  <MarketCard
                    key={m.id}
                    market={m}
                    hot={momentum(m) > 0.04}
                    enterDelay={Math.min(i, 11) * 35}
                  />
                )
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
