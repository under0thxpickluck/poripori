import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'

type Props = {
  title: string
  subtitle?: string
  children: ReactNode
}

// マーケティング／情報系ページ用の軽量レイアウト
export default function InfoLayout({ title, subtitle, children }: Props) {
  return (
    <div className="max-w-3xl mx-auto">
      <Link
        to="/"
        className="inline-flex items-center gap-1 text-sm text-text-muted hover:text-text mb-6 transition-colors"
      >
        <ArrowLeft size={14} />
        ホームに戻る
      </Link>

      <header className="mb-6 pb-6 border-b border-border">
        <h1 className="text-2xl font-bold text-text">{title}</h1>
        {subtitle && <p className="text-sm text-text-muted mt-2 leading-relaxed">{subtitle}</p>}
      </header>

      <div className="legal-prose">{children}</div>
    </div>
  )
}
