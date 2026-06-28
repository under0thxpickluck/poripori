import LegalLayout, { H2, P, UL, OL, LI, Strong, Callout } from '../../components/legal/LegalLayout'
import { COMPANY } from '../../lib/company'

export default function Compliance() {
  return (
    <LegalLayout
      title="Sanctions, AML & Prohibited Jurisdictions Policy"
      subtitle={`${COMPANY.legalName} is committed to operating ${COMPANY.product} lawfully and responsibly. This policy describes our approach to economic sanctions, anti–money laundering (AML), and restricted jurisdictions. It forms part of our Terms of Service.`}
    >
      <Callout>
        {COMPANY.product} uses <Strong>virtual points only</Strong> and does not process payments, deposits, or
        withdrawals. We nonetheless apply these commitments to prevent misuse of the platform and to comply with
        applicable law.
      </Callout>

      <H2 id="k1">1. Sanctions Compliance</H2>
      <OL>
        <LI>We comply with applicable economic and trade sanctions, including those administered by the U.S. Department of the Treasury’s Office of Foreign Assets Control (OFAC) and other relevant authorities.</LI>
        <LI>The Service may not be used by any person who is the target of sanctions, or who is owned or controlled by, or acting on behalf of, a sanctioned party.</LI>
        <LI>You represent and warrant that you are not on any sanctions or denied-party list and are not located in, or a resident of, a comprehensively sanctioned region.</LI>
      </OL>

      <H2 id="k2">2. Prohibited &amp; Restricted Jurisdictions</H2>
      <P>You may not access or use the Service if you are located in, ordinarily resident in, or accessing from a jurisdiction that is comprehensively sanctioned or where the Service is otherwise unlawful. This currently includes, without limitation, the Crimea, Donetsk, Luhansk, Kherson, and Zaporizhzhia regions, Cuba, Iran, North Korea, and Syria, and any other region we designate.</P>
      <P>We may add or remove restricted jurisdictions at any time and may use technical measures (such as IP-based controls) to enforce restrictions. Attempting to circumvent these controls (for example, via VPN or proxy) is prohibited.</P>

      <H2 id="k3">3. Anti–Money Laundering &amp; Counter-Terrorist Financing</H2>
      <OL>
        <LI>Because the Service involves no real money or transferable value, it presents limited money-laundering risk. We nevertheless prohibit any attempt to use the Service to launder money, finance terrorism, or move or disguise illicit value.</LI>
        <LI>If we introduce features involving real value in the future, we will implement appropriate AML/KYC controls, including identity verification and transaction monitoring, before doing so.</LI>
      </OL>

      <H2 id="k4">4. Monitoring &amp; Reporting</H2>
      <P>We may monitor activity for signs of sanctions evasion, fraud, or other unlawful conduct, consistent with our Privacy Policy. Where required or appropriate, we may freeze accounts and report to relevant authorities.</P>

      <H2 id="k5">5. Enforcement</H2>
      <P>Violations may result in immediate suspension or termination of access, reversal of activity, and other measures described in the Terms of Service and Market Integrity Policy.</P>

      <H2 id="k6">6. Contact</H2>
      <P>Compliance questions: <a href={`mailto:${COMPANY.emails.compliance}`} className="text-accent hover:underline">{COMPANY.emails.compliance}</a>.</P>
    </LegalLayout>
  )
}
