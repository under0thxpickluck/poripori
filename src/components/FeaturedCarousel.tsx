import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronLeft, ChevronRight, BarChart2 } from 'lucide-react'
import { marketPrice } from '../lib/lmsr'
import type { Market } from '../types'
import MarketImage from './MarketImage'

const CATEGORY_COLORS: Record<string, string> = {
  Politics: 'text-blue-400 bg-blue-400/10',
  Crypto: 'text-orange-400 bg-orange-400/10',
  Sports: 'text-green-400 bg-green-400/10',
  AI: 'text-purple-400 bg-purple-400/10',
  Tech: 'text-cyan-400 bg-cyan-400/10',
  Science: 'text-sky-400 bg-sky-400/10',
  Entertainment: 'text-pink-400 bg-pink-400/10',
}

const SLIDE_COUNT = 3
const AUTOPLAY_MS = 5000

function YesNoBar({ market }: { market: Market }) {
  const yesPct = Math.round(marketPrice(market).yes * 100)
  return (
    <div className="flex rounded-full overflow-hidden h-1.5">
      <div className="bg-yes" style={{ width: `${yesPct}%` }} />
      <div className="bg-no flex-1" />
    </div>
  )
}

function SideCard({ market }: { market: Market }) {
  const yesPct = Math.round(marketPrice(market).yes * 100)
  return (
    <Link
      to={`/market/${market.id}`}
      className="flex-1 flex items-center gap-3 bg-surface hover:bg-surface-hover border border-border hover:border-accent/40 rounded-lg p-3 transition-colors group"
    >
      <MarketImage
        src={market.imageUrl}
        category={market.category}
        className="w-11 h-11 rounded-md shrink-0"
      />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-text leading-snug line-clamp-2">{market.question}</p>
      </div>
      <div className="text-right shrink-0">
        <div className="text-base font-bold text-yes leading-none">{yesPct}%</div>
        <div className="text-[10px] text-text-muted mt-0.5">YES</div>
      </div>
    </Link>
  )
}

function SlideCard({ market, interactive }: { market: Market; interactive: boolean }) {
  const yesPct = Math.round(marketPrice(market).yes * 100)
  const noPct = 100 - yesPct
  const catColor = CATEGORY_COLORS[market.category] ?? 'text-text-muted bg-surface-hover'
  return (
    <Link
      to={`/market/${market.id}`}
      tabIndex={interactive ? 0 : -1}
      className={`block h-full bg-surface border border-border rounded-lg overflow-hidden shadow-lg transition-colors group ${
        interactive ? 'hover:border-accent/40 pointer-events-auto' : 'pointer-events-none'
      }`}
    >
      <MarketImage src={market.imageUrl} category={market.category} className="w-full h-40 sm:h-44" />
      <div className="p-5">
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${catColor}`}>
          {market.category}
        </span>
        <p className="mt-3 text-lg sm:text-xl font-bold text-text leading-snug line-clamp-2">
          {market.question}
        </p>
        <div className="mt-4 flex items-center gap-3">
          <span className="text-yes font-bold">YES {yesPct}¢</span>
          <span className="text-no font-bold">NO {noPct}¢</span>
          <span className="ml-auto flex items-center gap-1 text-xs text-text-muted">
            <BarChart2 size={12} />
            {market.volume.toLocaleString()} pt
          </span>
        </div>
        <div className="mt-3">
          <YesNoBar market={market} />
        </div>
      </div>
    </Link>
  )
}

// スタック内の位置(0=前面)ごとの見た目
const STACK_STYLE = [
  { transform: 'translateY(0) scale(1)', opacity: 1, zIndex: 30 },
  { transform: 'translateY(14px) scale(0.95)', opacity: 1, zIndex: 20 },
  { transform: 'translateY(28px) scale(0.90)', opacity: 1, zIndex: 10 },
]

export default function FeaturedCarousel({ markets }: { markets: Market[] }) {
  const slides = markets.slice(0, SLIDE_COUNT)
  const sideCards = markets.slice(SLIDE_COUNT)

  const [index, setIndex] = useState(0)
  const [paused, setPaused] = useState(false)

  const go = (next: number) => {
    if (slides.length === 0) return
    setIndex(((next % slides.length) + slides.length) % slides.length)
  }

  useEffect(() => {
    if (paused || slides.length <= 1) return
    const id = setInterval(() => {
      setIndex((i) => (i + 1) % slides.length)
    }, AUTOPLAY_MS)
    return () => clearInterval(id)
  }, [paused, slides.length, index])

  if (markets.length === 0) return null

  return (
    <div className="mb-8">
      <h2 className="text-lg font-bold text-text mb-3">注目のマーケット</h2>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* 左：プレート状に重なる大スライド */}
        <div
          className="lg:col-span-2 relative h-[372px] sm:h-[392px]"
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
        >
          {slides.map((m, i) => {
            const pos = (i - index + slides.length) % slides.length
            const style =
              pos < STACK_STYLE.length
                ? STACK_STYLE[pos]
                : { ...STACK_STYLE[STACK_STYLE.length - 1], opacity: 0 }
            return (
              <div
                key={m.id}
                className="absolute inset-x-0 top-0 h-[344px] sm:h-[364px]"
                style={{
                  ...style,
                  transition: 'transform 0.5s cubic-bezier(.4,0,.2,1), opacity 0.5s ease',
                }}
              >
                <SlideCard market={m} interactive={pos === 0} />
              </div>
            )
          })}

          {slides.length > 1 && (
            <>
              <button
                aria-label="前へ"
                onClick={() => go(index - 1)}
                className="absolute z-40 left-2 top-[172px] sm:top-[182px] -translate-y-1/2 w-8 h-8 rounded-full bg-bg/70 border border-border text-text flex items-center justify-center hover:bg-bg transition-colors"
              >
                <ChevronLeft size={18} />
              </button>
              <button
                aria-label="次へ"
                onClick={() => go(index + 1)}
                className="absolute z-40 right-2 top-[172px] sm:top-[182px] -translate-y-1/2 w-8 h-8 rounded-full bg-bg/70 border border-border text-text flex items-center justify-center hover:bg-bg transition-colors"
              >
                <ChevronRight size={18} />
              </button>
              <div className="absolute z-40 bottom-1 left-1/2 -translate-x-1/2 flex gap-1.5">
                {slides.map((s, i) => (
                  <button
                    key={s.id}
                    aria-label={`スライド ${i + 1}`}
                    onClick={() => go(i)}
                    className={`h-1.5 rounded-full transition-all ${
                      i === index ? 'w-5 bg-accent' : 'w-1.5 bg-text-muted/50 hover:bg-text-muted'
                    }`}
                  />
                ))}
              </div>
            </>
          )}
        </div>

        {/* 右：小カード群 */}
        {sideCards.length > 0 && (
          <div className="grid grid-cols-2 lg:grid-cols-1 lg:flex lg:flex-col gap-3">
            {sideCards.map((m) => (
              <SideCard key={m.id} market={m} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
