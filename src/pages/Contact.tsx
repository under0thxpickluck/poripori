import LegalLayout, { H2, P, Strong, Callout } from '../components/legal/LegalLayout'
import { COMPANY } from '../lib/company'

const CHANNELS = [
  { topic: 'General support', email: COMPANY.emails.support, desc: 'Help with your account, features, or anything else.' },
  { topic: 'Legal', email: COMPANY.emails.legal, desc: 'Terms, intellectual property, and legal notices (incl. DMCA).' },
  { topic: 'Privacy & data requests', email: COMPANY.emails.privacy, desc: 'Access, deletion, and other data-rights requests.' },
  { topic: 'Data Protection Officer', email: COMPANY.emails.dpo, desc: 'GDPR/Privacy oversight and inquiries.' },
  { topic: 'Market integrity', email: COMPANY.emails.integrity, desc: 'Report manipulation, disputes, or resolution issues.' },
  { topic: 'Compliance', email: COMPANY.emails.compliance, desc: 'Sanctions, AML, and restricted-jurisdiction questions.' },
  { topic: 'Security', email: COMPANY.emails.security, desc: 'Report a vulnerability (see Responsible Disclosure Policy).' },
]

export default function Contact() {
  return (
    <LegalLayout
      title="Contact"
      subtitle={`Reach the right team at ${COMPANY.legalName} using the dedicated contacts below.`}
    >
      <Callout>
        We aim to respond to most inquiries within a few business days. For security reports, please follow our{' '}
        Responsible Disclosure Policy.
      </Callout>

      <H2 id="ct1">Contact Channels</H2>
      <div className="not-prose grid grid-cols-1 sm:grid-cols-2 gap-3 my-4">
        {CHANNELS.map((c) => (
          <div key={c.email} className="rounded-lg border border-border bg-surface p-4">
            <p className="text-sm font-semibold text-text">{c.topic}</p>
            <a href={`mailto:${c.email}`} className="text-sm text-accent hover:underline break-all">
              {c.email}
            </a>
            <p className="text-xs text-text-muted leading-relaxed mt-1">{c.desc}</p>
          </div>
        ))}
      </div>

      <H2 id="ct2">Mailing Address</H2>
      <P>
        <Strong>{COMPANY.legalName}</Strong>
        <br />
        {COMPANY.addressLines.map((l, i) => (
          <span key={i}>
            {l}
            <br />
          </span>
        ))}
      </P>

      <H2 id="ct3">Note</H2>
      <P>
        {COMPANY.product} uses virtual points only and provides no real-money services. Please do not send sensitive
        personal or financial information by email. For data-rights requests, use the privacy contact above so we can
        verify your identity appropriately.
      </P>
    </LegalLayout>
  )
}
