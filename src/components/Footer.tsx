import { Link } from 'react-router-dom'
import { useTheme } from '../store/useTheme'

type FooterLink = { label: string; href: string; action?: 'help' }

const SOCIAL: FooterLink[] = [
  { label: 'X (Twitter)', href: '#' },
  { label: 'Instagram', href: '#' },
  { label: 'Discord', href: '#' },
  { label: 'TikTok', href: '#' },
]

const SUPPORT: FooterLink[] = [
  { label: '使い方ガイド', href: '#', action: 'help' },
  { label: 'ニュース', href: '#' },
  { label: 'お問い合わせ', href: '#' },
  { label: 'ヘルプセンター', href: '#', action: 'help' },
  { label: 'ステータス', href: '#' },
]

const RESOURCES: FooterLink[] = [
  { label: '報酬', href: '#' },
  { label: 'API', href: '#' },
  { label: 'ランキング', href: '/ranking' },
  { label: '正確さ', href: '#' },
  { label: 'ブランド', href: '#' },
  { label: 'アクティビティ', href: '#' },
  { label: '採用情報', href: '#' },
  { label: 'プレス', href: '#' },
]

const LEGAL: FooterLink[] = [
  { label: 'プライバシー', href: '#' },
  { label: '利用規約', href: '#' },
  { label: '市場の健全性', href: '#' },
  { label: 'ドキュメント', href: '#' },
]

const COLUMNS: { title: string; links: FooterLink[] }[] = [
  { title: 'ソーシャル', links: SOCIAL },
  { title: 'サポート', links: SUPPORT },
  { title: 'リソース', links: RESOURCES },
  { title: '法的事項', links: LEGAL },
]

function FooterLinkItem({ label, href, action }: FooterLink) {
  if (action === 'help') {
    return (
      <button
        onClick={() => window.dispatchEvent(new CustomEvent('open-help'))}
        className="text-sm text-text-muted hover:text-text transition-colors"
      >
        {label}
      </button>
    )
  }
  if (href.startsWith('/')) {
    return (
      <Link to={href} className="text-sm text-text-muted hover:text-text transition-colors">
        {label}
      </Link>
    )
  }
  return (
    <a href={href} className="text-sm text-text-muted hover:text-text transition-colors">
      {label}
    </a>
  )
}

export default function Footer() {
  const theme = useTheme((s) => s.theme)
  const logo = theme === 'light' ? '/logo-light.png' : '/logo.png'
  return (
    <footer className="border-t border-border mt-12">
      <div className="max-w-7xl mx-auto px-4 py-10">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-8">
          <div className="col-span-2 md:col-span-1">
            <Link to="/" className="inline-block">
              <img src={logo} alt="MIRAIX" className="h-10 w-auto" />
            </Link>
            <p className="text-xs text-text-muted mt-3 leading-relaxed">
              みんなの予測でつくる、新しい情報市場。
            </p>
          </div>

          {COLUMNS.map((col) => (
            <div key={col.title}>
              <h3 className="text-xs font-semibold text-text mb-3">{col.title}</h3>
              <ul className="space-y-2">
                {col.links.map((link) => (
                  <li key={link.label}>
                    <FooterLinkItem {...link} />
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="border-t border-border mt-8 pt-6 flex flex-col sm:flex-row items-center justify-between gap-2">
          <p className="text-xs text-text-muted">© 2026 MIRAIX. すべて仮データです。</p>
          <p className="text-xs text-text-muted">本サイトはデモであり、実際の取引は行われません。</p>
        </div>
      </div>
    </footer>
  )
}
