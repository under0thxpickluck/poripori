import { Link } from 'react-router-dom'
import {
  FileText,
  Shield,
  Cookie,
  Scale,
  Users,
  AlertTriangle,
  Landmark,
  Bug,
  Building2,
  Mail,
  ArrowRight,
} from 'lucide-react'
import { COMPANY } from '../../lib/company'

const DOCS = [
  { to: '/legal/terms', label: 'Terms of Service', desc: 'The master agreement governing your use of the platform.', Icon: FileText },
  { to: '/legal/privacy', label: 'Privacy Policy', desc: 'How we collect, use, protect and share personal data.', Icon: Shield },
  { to: '/legal/cookies', label: 'Cookie & Storage Policy', desc: 'Cookies and local storage we use, and how to manage them.', Icon: Cookie },
  { to: '/legal/market-integrity', label: 'Market Integrity Policy', desc: 'Prohibited conduct, surveillance, and market resolution.', Icon: Scale },
  { to: '/legal/community', label: 'Community Guidelines & Acceptable Use', desc: 'Rules for content, conduct, and acceptable use.', Icon: Users },
  { to: '/legal/risk', label: 'Risk Disclosure & Disclaimers', desc: 'The nature of forecasting and the risks of using the service.', Icon: AlertTriangle },
  { to: '/legal/compliance', label: 'Sanctions, AML & Prohibited Jurisdictions', desc: 'Sanctions screening, AML commitments, and restricted regions.', Icon: Landmark },
  { to: '/legal/security', label: 'Responsible Disclosure Policy', desc: 'How to report a security vulnerability to our team.', Icon: Bug },
  { to: '/company', label: 'Company', desc: `About ${COMPANY.legalName}.`, Icon: Building2 },
  { to: '/contact', label: 'Contact', desc: 'Dedicated contact points by topic.', Icon: Mail },
]

export default function LegalHub() {
  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-8">
        <p className="text-xs font-semibold text-accent mb-1">{COMPANY.legalName}</p>
        <h1 className="text-2xl font-bold text-text mb-2">Legal Center</h1>
        <p className="text-sm text-text-muted leading-relaxed max-w-2xl">
          {COMPANY.product} is {COMPANY.productDesc} operated by {COMPANY.legalName}. Below you will find the
          terms, privacy practices, and market-integrity policies that govern the service. Last updated:{' '}
          {COMPANY.lastUpdated}.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {DOCS.map(({ to, label, desc, Icon }) => (
          <Link
            key={to}
            to={to}
            className="group flex items-start gap-3 rounded-lg border border-border bg-surface hover:border-accent/40 hover:bg-surface-hover p-5 transition-colors"
          >
            <div className="w-10 h-10 rounded-lg bg-accent/10 text-accent flex items-center justify-center shrink-0">
              <Icon size={18} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <h2 className="text-sm font-semibold text-text">{label}</h2>
                <ArrowRight size={13} className="text-text-muted group-hover:text-accent group-hover:translate-x-0.5 transition-all" />
              </div>
              <p className="text-xs text-text-muted leading-relaxed mt-1">{desc}</p>
            </div>
          </Link>
        ))}
      </div>

      <div className="mt-8 rounded-lg border border-border bg-surface p-5 text-sm text-text-muted leading-7">
        <p>
          {COMPANY.product} uses <span className="text-text font-semibold">virtual points only</span>. It does not
          involve real money, cryptocurrency, or anything of monetary value, and virtual points cannot be
          redeemed, withdrawn, or sold. These documents are governed by {COMPANY.governingLaw}. {COMPANY.legalName}{' '}
          may amend them from time to time; material changes will be announced within the service.
        </p>
      </div>
    </div>
  )
}
