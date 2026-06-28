import type { ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { ArrowLeft, FileText, Mail } from 'lucide-react'
import { COMPANY, LEGAL_INDEX } from '../../lib/company'

// ── プロース用の共通プレゼンテーション要素 ──────────────────────
export function H2({ id, children }: { id?: string; children: ReactNode }) {
  return (
    <h2 id={id} className="scroll-mt-24 text-lg font-bold text-text mt-10 mb-3 pb-2 border-b border-border">
      {children}
    </h2>
  )
}

export function H3({ children }: { children: ReactNode }) {
  return <h3 className="text-sm font-semibold text-text mt-6 mb-2">{children}</h3>
}

export function P({ children }: { children: ReactNode }) {
  return <p className="text-sm text-text-muted leading-7 mb-3">{children}</p>
}

export function UL({ children }: { children: ReactNode }) {
  return <ul className="list-disc pl-5 space-y-1.5 text-sm text-text-muted leading-7 mb-3">{children}</ul>
}

export function OL({ children }: { children: ReactNode }) {
  return <ol className="list-decimal pl-5 space-y-1.5 text-sm text-text-muted leading-7 mb-3">{children}</ol>
}

export function LI({ children }: { children: ReactNode }) {
  return <li className="pl-1">{children}</li>
}

export function Strong({ children }: { children: ReactNode }) {
  return <span className="text-text font-semibold">{children}</span>
}

export function Callout({ children, tone = 'note' }: { children: ReactNode; tone?: 'note' | 'warn' }) {
  const cls =
    tone === 'warn'
      ? 'border-no/40 bg-no/5'
      : 'border-accent/40 bg-accent/5'
  return (
    <div className={`rounded-lg border ${cls} p-4 text-sm text-text-muted leading-7 my-4`}>{children}</div>
  )
}

// ── レイアウト本体 ────────────────────────────────────────────
type Props = {
  title: string
  subtitle?: string
  children: ReactNode
}

export default function LegalLayout({ title, subtitle, children }: Props) {
  const { pathname } = useLocation()

  return (
    <div className="max-w-6xl mx-auto">
      <Link
        to="/legal"
        className="inline-flex items-center gap-1 text-sm text-text-muted hover:text-text mb-6 transition-colors"
      >
        <ArrowLeft size={14} />
        Legal Center
      </Link>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Body */}
        <article className="lg:col-span-3 min-w-0">
          <header className="mb-6 pb-6 border-b border-border">
            <p className="text-xs font-semibold text-accent mb-1">{COMPANY.product} Legal</p>
            <h1 className="text-2xl font-bold text-text">{title}</h1>
            {subtitle && <p className="text-sm text-text-muted mt-2 leading-relaxed">{subtitle}</p>}
            <div className="flex flex-wrap gap-x-6 gap-y-1 mt-4 text-xs text-text-muted">
              <span>Effective: {COMPANY.effectiveDate}</span>
              <span>Last updated: {COMPANY.lastUpdated}</span>
              <span>Issued by: {COMPANY.legalName}</span>
            </div>
          </header>

          <div className="legal-prose">{children}</div>

          {/* Contact footer */}
          <div className="mt-12 rounded-lg border border-border bg-surface p-5">
            <h2 className="text-sm font-semibold text-text mb-2 flex items-center gap-1.5">
              <Mail size={14} className="text-accent" />
              Questions about this document
            </h2>
            <p className="text-sm text-text-muted leading-7">
              {COMPANY.legalName} (operator of {COMPANY.product})
              <br />
              {COMPANY.addressInline}
              <br />
              Legal:{' '}
              <a href={`mailto:${COMPANY.emails.legal}`} className="text-accent hover:underline">
                {COMPANY.emails.legal}
              </a>
              {' · '}
              General:{' '}
              <a href={`mailto:${COMPANY.emails.support}`} className="text-accent hover:underline">
                {COMPANY.emails.support}
              </a>
            </p>
          </div>
        </article>

        {/* Sidebar */}
        <aside className="lg:col-span-1">
          <div className="lg:sticky lg:top-20 space-y-1">
            <p className="text-xs font-semibold text-text-muted px-3 mb-1 flex items-center gap-1.5">
              <FileText size={13} />
              All documents
            </p>
            {LEGAL_INDEX.map((d) => {
              const active = pathname === d.to
              return (
                <Link
                  key={d.to}
                  to={d.to}
                  className={`block px-3 py-2 rounded-lg text-sm transition-colors ${
                    active
                      ? 'bg-accent/15 text-accent font-medium'
                      : 'text-text-muted hover:text-text hover:bg-surface-hover'
                  }`}
                >
                  {d.label}
                </Link>
              )
            })}
          </div>
        </aside>
      </div>
    </div>
  )
}
