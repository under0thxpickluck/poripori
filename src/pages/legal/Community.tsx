import LegalLayout, { H2, P, UL, OL, LI, Strong, Callout } from '../../components/legal/LegalLayout'
import { COMPANY } from '../../lib/company'

export default function Community() {
  return (
    <LegalLayout
      title="Community Guidelines & Acceptable Use Policy"
      subtitle={`These guidelines explain how to participate respectfully on ${COMPANY.product} and what uses of the Service are not allowed. They form part of our Terms of Service and apply to comments, proposed markets, usernames, and all other activity.`}
    >
      <Callout>
        Be accurate, be civil, and don’t game the system. Conduct that harms other users, distorts markets, or
        breaks the law can lead to content removal and account action.
      </Callout>

      <H2 id="g1">1. Expected Behavior</H2>
      <UL>
        <LI>Engage in good faith and contribute genuine forecasts and analysis.</LI>
        <LI>Treat other users with respect, even in disagreement.</LI>
        <LI>Keep discussion relevant to the market or topic.</LI>
        <LI>Respect others’ privacy and intellectual property.</LI>
      </UL>

      <H2 id="g2">2. Prohibited Content</H2>
      <P>Do not post, propose, or transmit content that:</P>
      <UL>
        <LI>Is unlawful, or promotes illegal activity.</LI>
        <LI>Harasses, threatens, bullies, or incites violence or self-harm.</LI>
        <LI>Is hateful or discriminatory based on race, ethnicity, nationality, religion, sex, gender, sexual orientation, disability, or similar protected characteristics.</LI>
        <LI>Is sexually explicit, obscene, or exploits or endangers minors.</LI>
        <LI>Discloses another person’s private or identifying information without authorization (“doxxing”).</LI>
        <LI>Is defamatory, deceptive, or knowingly false in a harmful way.</LI>
        <LI>Infringes copyright, trademark, trade secret, or other rights.</LI>
        <LI>Contains malware, phishing, scams, or unsolicited advertising or spam.</LI>
        <LI>Impersonates any person or entity, including {COMPANY.shortName} staff.</LI>
      </UL>

      <H2 id="g3">3. Prohibited Uses</H2>
      <P>Do not:</P>
      <UL>
        <LI>Manipulate markets, wash trade, collude, or operate abusive multiple accounts (see the Market Integrity Policy).</LI>
        <LI>Exploit bugs or pricing errors, or circumvent security or integrity controls.</LI>
        <LI>Use bots, scrapers, or automated access without our written permission.</LI>
        <LI>Reverse engineer, decompile, or attempt to extract source code, except as permitted by law.</LI>
        <LI>Overload, disrupt, or interfere with the Service or its infrastructure.</LI>
        <LI>Resell, sublicense, or commercially exploit the Service without authorization.</LI>
        <LI>Use the Service where prohibited by the Sanctions, AML &amp; Prohibited Jurisdictions Policy.</LI>
      </UL>

      <H2 id="g4">4. Usernames &amp; Profiles</H2>
      <P>Usernames must not be offensive, impersonate others, infringe trademarks, or mislead. To protect privacy, the Service may mask usernames when displayed to other users. We may rename or reset non-compliant identifiers.</P>

      <H2 id="g5">5. Reporting &amp; Moderation</H2>
      <OL>
        <LI>You can report content or conduct to <a href={`mailto:${COMPANY.emails.support}`} className="text-accent hover:underline">{COMPANY.emails.support}</a> (general) or <a href={`mailto:${COMPANY.emails.integrity}`} className="text-accent hover:underline">{COMPANY.emails.integrity}</a> (market integrity).</LI>
        <LI>We may remove or hide content, and may warn, restrict, suspend, or terminate accounts, with or without notice, proportionate to the violation.</LI>
        <LI>We do not tolerate retaliation against good-faith reporters.</LI>
      </OL>

      <H2 id="g6">6. Enforcement &amp; Appeals</H2>
      <P>Enforcement aims to be proportionate and consistent. If you believe an action was taken in error, you may contact {COMPANY.emails.support} to request review. We will consider appeals in good faith; our decision following review is final for the purposes of the Service.</P>

      <H2 id="g7">7. Updates</H2>
      <P>We may update these guidelines as the community and the Service evolve. Material changes will be announced within the Service.</P>
    </LegalLayout>
  )
}
