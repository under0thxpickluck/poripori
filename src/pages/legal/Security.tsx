import LegalLayout, { H2, P, UL, OL, LI, Strong, Callout } from '../../components/legal/LegalLayout'
import { COMPANY } from '../../lib/company'

export default function Security() {
  return (
    <LegalLayout
      title="Responsible Disclosure Policy"
      subtitle={`${COMPANY.legalName} welcomes reports from security researchers. This policy explains how to report a vulnerability in ${COMPANY.product} and what you can expect from us.`}
    >
      <Callout>
        Act in good faith, avoid privacy violations and service disruption, and give us a reasonable chance to fix
        issues before public disclosure. We will not pursue good-faith research that follows this policy.
      </Callout>

      <H2 id="s1">1. Scope</H2>
      <P>This policy covers the {COMPANY.product} web application and its official domains. Third-party services we do not operate are out of scope; please report those to the relevant provider.</P>

      <H2 id="s2">2. How to Report</H2>
      <OL>
        <LI>Email <a href={`mailto:${COMPANY.emails.security}`} className="text-accent hover:underline">{COMPANY.emails.security}</a> with a clear description, steps to reproduce, affected URLs or components, and any proof-of-concept.</LI>
        <LI>Include your contact details so we can follow up.</LI>
        <LI>Encrypt sensitive details where possible, and do not include third-party personal data.</LI>
      </OL>

      <H2 id="s3">3. Guidelines for Researchers</H2>
      <UL>
        <LI>Do not access, modify, or delete data that is not yours; use only test accounts and data.</LI>
        <LI>Do not perform denial-of-service, spam, social engineering, or physical attacks.</LI>
        <LI>Do not publicly disclose details until we confirm the issue is resolved or mutually agree on timing.</LI>
        <LI>Stop testing and report immediately if you encounter personal data.</LI>
      </UL>

      <H2 id="s4">4. Our Commitments</H2>
      <UL>
        <LI>We aim to acknowledge reports within <Strong>5 business days</Strong>.</LI>
        <LI>We will keep you informed of remediation progress and credit researchers who wish to be acknowledged.</LI>
        <LI>We will not take legal action against researchers acting in good faith under this policy.</LI>
      </UL>

      <H2 id="s5">5. Safe Harbor</H2>
      <P>Activities conducted consistently with this policy are considered authorized, and we will not initiate or support legal action against you for such activities. If legal action is brought by a third party against you for activities conducted in accordance with this policy, we will make this authorization known.</P>

      <H2 id="s6">6. Rewards</H2>
      <P>We do not currently operate a paid bug-bounty program but greatly appreciate responsible reports and offer public acknowledgment where desired. If a formal program is introduced, its terms will be published here.</P>
    </LegalLayout>
  )
}
