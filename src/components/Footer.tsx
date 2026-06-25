import { Link } from 'react-router-dom'
import { useTheme } from '../store/useTheme'
import { COMPANY } from '../lib/company'

type FooterLink = { label: string; href: string; action?: 'help' }

const SOCIAL: FooterLink[] = [
  { label: 'X (Twitter)', href: '#' },
  { label: 'Instagram', href: '#' },
  { label: 'Discord', href: '#' },
  { label: 'TikTok', href: '#' },
]

const SUPPORT: FooterLink[] = [
  { label: '使い方ガイド', href: '#', action: 'help' },
  { label: 'ヘルプセンター', href: '#', action: 'help' },
  { label: 'お問い合わせ / Contact', href: '/contact' },
  { label: 'セキュリティ報告', href: '/legal/security' },
  { label: 'ステータス', href: '#' },
]

const RESOURCES: FooterLink[] = [
  { label: 'ランキング', href: '/ranking' },
  { label: '会社概要 / Company', href: '/company' },
  { label: '市場の健全性', href: '/legal/market-integrity' },
  { label: 'コンプライアンス', href: '/legal/compliance' },
  { label: 'API', href: '#' },
  { label: 'プレス', href: '#' },
]

const LEGAL: FooterLink[] = [
  { label: 'Terms of Service', href: '/legal/terms' },
  { label: 'Privacy Policy', href: '/legal/privacy' },
  { label: 'Cookie & Storage', href: '/legal/cookies' },
  { label: 'Risk Disclosure', href: '/legal/risk' },
  { label: 'Legal Center', href: '/legal' },
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

        <div className="border-t border-border mt-8 pt-6 flex flex-col sm:flex-row items-center justify-between gap-2 text-center sm:text-left">
          <p className="text-xs text-text-muted">
            © 2026 {COMPANY.legalName} ・ {COMPANY.product}
            <span className="hidden sm:inline"> ・ {COMPANY.addressInline}</span>
          </p>
          <p className="text-xs text-text-muted">
            仮想ポイントのみを使用し、実際の金銭取引は行いません。
          </p>
        </div>
      </div>
    </footer>
  )
}
