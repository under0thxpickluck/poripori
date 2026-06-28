import LegalLayout, { H2, H3, P, UL, OL, LI, Strong, Callout } from '../../components/legal/LegalLayout'
import { COMPANY } from '../../lib/company'

export default function MarketIntegrity() {
  return (
    <LegalLayout
      title="Market Integrity Policy"
      subtitle={`This Market Integrity Policy (the “Policy”) sets out the standards that keep ${COMPANY.product} markets fair, accurate, and trustworthy. It explains prohibited conduct, how markets are created and resolved, how we monitor activity, and how we enforce these rules. It forms part of our Terms of Service.`}
    >
      <Callout>
        Even though {COMPANY.product} uses <Strong>virtual points only</Strong>, market integrity matters: prices are
        meant to reflect genuine collective probability estimates. Conduct that distorts prices or resolution
        undermines the platform for everyone and is prohibited.
      </Callout>

      <H2 id="m1">1. Principles</H2>
      <OL>
        <LI><Strong>Fair price formation.</Strong> Prices should emerge from genuine, independent forecasts, not coordinated or deceptive activity.</LI>
        <LI><Strong>Accurate resolution.</Strong> Markets must resolve to the true real-world outcome under clear, pre-stated criteria.</LI>
        <LI><Strong>Transparency.</Strong> Rules, resolution sources, and enforcement actions are described and applied consistently.</LI>
        <LI><Strong>Proportionate enforcement.</Strong> We take the least intrusive effective action, escalating for repeated or severe violations.</LI>
      </OL>

      <H2 id="m2">2. Prohibited Trading Conduct</H2>
      <P>The following are prohibited. This list is illustrative, not exhaustive.</P>
      <H3>2.1 Manipulation</H3>
      <UL>
        <LI><Strong>Price manipulation.</Strong> Trading designed to move a market to an artificial level rather than to express a genuine forecast.</LI>
        <LI><Strong>Spoofing / layering.</Strong> Entering activity intended to create a misleading impression of demand or probability.</LI>
        <LI><Strong>Momentum ignition / “pump.”</Strong> Coordinated bursts intended to trigger reactions from other users.</LI>
        <LI><Strong>Marking the close.</Strong> Trading intended to distort a market’s price near its deadline or a measurement point.</LI>
      </UL>
      <H3>2.2 Wash Trading &amp; Collusion</H3>
      <UL>
        <LI><Strong>Wash trading.</Strong> Trading with yourself, or between accounts you control, with no genuine change in market view, including to inflate volume, rankings, or rewards.</LI>
        <LI><Strong>Collusion.</Strong> Coordinating with others to move prices, fix outcomes, or game leaderboards and achievements.</LI>
        <LI><Strong>Abusive multi-accounting.</Strong> Using multiple accounts to evade limits, multiply influence, or simulate independent activity.</LI>
      </UL>
      <H3>2.3 Information Misuse</H3>
      <UL>
        <LI><Strong>Resolution-source manipulation.</Strong> Attempting to influence, fabricate, or alter the real-world source or evidence used to resolve a market.</LI>
        <LI><Strong>Misuse of non-public information.</Strong> Trading on, or sharing, material non-public information that you have a duty to keep confidential, or that was obtained unlawfully.</LI>
        <LI><Strong>Self-resolving markets.</Strong> Creating or trading a market over an outcome you can unilaterally cause or control in bad faith.</LI>
      </UL>
      <H3>2.4 Technical Abuse</H3>
      <UL>
        <LI>Exploiting bugs, pricing errors, or latency to obtain an unfair advantage.</LI>
        <LI>Automated or high-frequency activity that degrades the Service or others’ experience, absent our written permission.</LI>
        <LI>Unauthorized access, scraping, or interference with the Service’s integrity controls.</LI>
      </UL>

      <H2 id="m3">3. Market Creation Standards</H2>
      <P>Proposed markets are reviewed before publication. To be approved, a market should be:</P>
      <UL>
        <LI><Strong>Clear and objective.</Strong> A reasonable person can determine YES or NO from the stated criteria.</LI>
        <LI><Strong>Verifiable.</Strong> The outcome can be confirmed from a credible, identifiable source by the deadline.</LI>
        <LI><Strong>Time-bound.</Strong> It states a definite deadline and resolution timing.</LI>
        <LI><Strong>Lawful and appropriate.</Strong> It complies with the Community Guidelines and does not target prohibited subjects.</LI>
      </UL>
      <H3>Prohibited market subjects</H3>
      <UL>
        <LI>Markets that incentivize, glorify, or could facilitate violence, harm to a specific identifiable person, terrorism, or other crimes (e.g., “assassination”-type markets).</LI>
        <LI>Markets on the private, non-public personal information of identifiable individuals.</LI>
        <LI>Markets designed to be ambiguous or unresolvable, or that have no good-faith resolution source.</LI>
        <LI>Markets that violate law or third-party rights.</LI>
      </UL>
      <P>We may decline, edit, relabel, suspend, or unpublish any market at our discretion.</P>

      <H2 id="m4">4. Resolution &amp; Oracle</H2>
      <OL>
        <LI><Strong>Authority.</Strong> Markets are resolved by {COMPANY.shortName} or a resolver we designate, based on the market’s stated criteria and credible public sources.</LI>
        <LI><Strong>Standard of proof.</Strong> Resolution reflects the most reliable available evidence as of the resolution time.</LI>
        <LI><Strong>Timing.</Strong> We resolve within a reasonable period after the deadline or after the determining event is confirmed.</LI>
        <LI><Strong>Ambiguity &amp; edge cases.</Strong> Where criteria are ambiguous, we interpret them in good faith consistent with the market’s evident intent. Where an outcome cannot be fairly determined, we may mark a market <Strong>invalid / not-applicable</Strong> and settle it by reversing trades and restoring balances, or by another reasonable method.</LI>
        <LI><Strong>Source changes &amp; force majeure.</Strong> If a designated source becomes unavailable or unreliable, we may substitute an equivalent credible source or void the market.</LI>
        <LI><Strong>Finality.</Strong> Resolutions are final once published, except where reopened under the dispute process below or to correct a manifest error.</LI>
      </OL>

      <H2 id="m5">5. Disputes &amp; Appeals</H2>
      <OL>
        <LI>If you believe a market was resolved incorrectly, you may submit a dispute to {COMPANY.emails.integrity} within <Strong>72 hours</Strong> of resolution, including the market, the outcome you believe is correct, and supporting evidence.</LI>
        <LI>We will review in good faith and may uphold, reverse, or re-resolve the market, or leave it unchanged.</LI>
        <LI>We may temporarily freeze settlement of a contested market while a dispute is reviewed.</LI>
        <LI>Our determination following review is final for the purposes of the Service.</LI>
      </OL>

      <H2 id="m6">6. Surveillance &amp; Monitoring</H2>
      <P>To protect integrity, we may monitor trading and account activity, including patterns across accounts, devices, and timing. We may use automated and manual techniques to detect manipulation, wash trading, collusion, and multi-accounting. This monitoring is conducted consistent with our Privacy Policy.</P>

      <H2 id="m7">7. Enforcement</H2>
      <P>Where we find a violation, or a credible risk of one, we may take any of the following actions, proportionate to the conduct:</P>
      <UL>
        <LI>Issue a warning or request corrective action.</LI>
        <LI>Cancel or reverse offending trades and adjust Virtual Point balances, volume, levels, achievements, or rankings.</LI>
        <LI>Void or re-resolve affected markets.</LI>
        <LI>Restrict features, limit position sizes, or rate-limit activity.</LI>
        <LI>Suspend, freeze, or terminate one or more accounts.</LI>
        <LI>Report unlawful conduct to relevant authorities where appropriate.</LI>
      </UL>

      <H2 id="m8">8. Conflicts of Interest</H2>
      <P>{COMPANY.shortName} personnel involved in resolution must not trade in a manner that exploits their role or non-public knowledge of pending resolutions. We maintain internal controls to separate market operation from privileged participation.</P>

      <H2 id="m9">9. Reporting</H2>
      <P>If you observe conduct that may breach this Policy, please report it to <a href={`mailto:${COMPANY.emails.integrity}`} className="text-accent hover:underline">{COMPANY.emails.integrity}</a>. We do not tolerate retaliation against good-faith reporters.</P>

      <H2 id="m10">10. Updates</H2>
      <P>We may update this Policy to address new risks and improve fairness. Material changes will be announced within the Service.</P>
    </LegalLayout>
  )
}
