import { ExternalLink } from 'lucide-react'
import MarketImage from './MarketImage'
import type { Ad } from '../types'

export default function AdCard({ ad }: { ad: Ad }) {
  return (
    <a
      href={ad.linkUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="block bg-surface hover:bg-surface-hover border border-border hover:border-accent/40 rounded-lg p-5 transition-colors duration-200 group relative"
    >
      <span className="absolute top-3 right-3 text-[10px] font-medium px-1.5 py-0.5 rounded bg-surface-hover text-text-muted border border-border">
        広告
      </span>
      <div className="flex gap-3 mb-4">
        {ad.imageUrl ? (
          <img src={ad.imageUrl} alt="" className="w-12 h-12 rounded-md shrink-0 object-cover" />
        ) : (
          <MarketImage category="" className="w-12 h-12 rounded-md shrink-0" />
        )}
        <p className="text-sm font-medium text-text leading-snug line-clamp-3 pr-8">{ad.title}</p>
      </div>
      <div className="flex items-center gap-1 text-xs text-accent">
        <ExternalLink size={11} />
        <span>詳しく見る</span>
      </div>
    </a>
  )
}
