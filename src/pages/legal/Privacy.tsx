import LegalLayout, { H2, P, UL, LI, Strong, Callout } from '../../components/legal/LegalLayout'
import { COMPANY } from '../../lib/company'

export default function Privacy() {
  return (
    <LegalLayout
      title="Privacy Policy"
      subtitle={`${COMPANY.legalName} (“${COMPANY.shortName},” “we,” “us”) describes how it handles personal data in connection with the “${COMPANY.product}” prediction market platform (the “Service”) in this Privacy Policy (this “Policy”).`}
    >
      <Callout>
        <Strong>How data is stored.</Strong> The Service stores your activity data — such as your display name,
        Virtual Point balance, positions, trade history, and comments — primarily in your <Strong>browser’s local
        storage on your device</Strong>. You can delete this data at any time by clearing your browser data. Where
        we process personal data on our servers, we handle it in accordance with this Policy.
      </Callout>

      <H2 id="p1">1. Information We Collect</H2>
      <P>We may collect and process the following in connection with providing the Service:</P>
      <UL>
        <LI><Strong>Account information:</Strong> the username you register and information used for authentication.</LI>
        <LI><Strong>Usage data:</Strong> Virtual Point balances, positions, trade history, proposed Markets, comments, levels, and achievements — your activity within the Service.</LI>
        <LI><Strong>Technical information:</Strong> IP address, browser and OS type, device identifiers, referring URLs, access timestamps, and operation logs generated automatically on access.</LI>
        <LI><Strong>Cookies &amp; local storage:</Strong> information obtained through the technologies described in our Cookie &amp; Storage Policy.</LI>
        <LI><Strong>Inquiry information:</Strong> the name, contact details, and contents you provide when contacting us.</LI>
      </UL>
      <P>We do not intentionally collect special-category or sensitive data (such as race, beliefs, health, or sex life).</P>

      <H2 id="p2">2. How We Use Information</H2>
      <UL>
        <LI>To provide, maintain, protect, and improve the Service.</LI>
        <LI>To authenticate Accounts and prevent abuse.</LI>
        <LI>To resolve Markets, settle Virtual Points, and provide features such as rankings.</LI>
        <LI>To safeguard market integrity (e.g., detecting manipulation, wash trading, and multi-accounting).</LI>
        <LI>To respond to inquiries and provide support.</LI>
        <LI>To analyze usage, produce statistics, and develop the Service.</LI>
        <LI>To send important notices, including changes to terms.</LI>
        <LI>To comply with law, protect rights, and handle disputes.</LI>
      </UL>

      <H2 id="p3">3. Legal Bases (GDPR &amp; Similar)</H2>
      <P>For users in the European Economic Area (EEA), the UK, and similar jurisdictions, we process personal data on the following legal bases:</P>
      <UL>
        <LI><Strong>Performance of a contract:</Strong> processing necessary to provide the Service.</LI>
        <LI><Strong>Legitimate interests:</Strong> fraud prevention, security, market integrity, and service improvement, where not overridden by your rights and interests.</LI>
        <LI><Strong>Consent:</Strong> for optional cookies, analytics, and similar processing. You may withdraw consent at any time.</LI>
        <LI><Strong>Legal obligation:</Strong> processing required by law.</LI>
      </UL>

      <H2 id="p4">4. Sharing &amp; Disclosure</H2>
      <P>We do not share your personal data with third parties except as described below. We do not sell your personal data.</P>
      <UL>
        <LI>With your consent.</LI>
        <LI>With service providers (e.g., cloud, analytics, and support vendors) processing data under our instructions and to the extent necessary.</LI>
        <LI>Where required by law or in response to a lawful request from a public authority.</LI>
        <LI>Where necessary to protect the rights, property, or safety of us, our users, or third parties.</LI>
        <LI>To a successor in connection with a merger, acquisition, or transfer of business.</LI>
      </UL>
      <P>Given the nature of the Service, some activity — such as your username (including a masked display name), position sizes, trades, and comments — may be visible to other users. The scope of visibility depends on the features of the Service.</P>

      <H2 id="p5">5. International Data Transfers</H2>
      <P>We are located in {COMPANY.jurisdiction}, and your information may be processed and stored in the United States and other countries whose laws may not provide the same level of protection as your home country. For transfers from the EEA and the UK, we rely on appropriate safeguards such as Standard Contractual Clauses (SCCs).</P>

      <H2 id="p6">6. Retention</H2>
      <P>We retain information for as long as necessary to fulfill the purposes described, or as required by law, after which we delete or anonymize it appropriately. Data stored in your browser’s local storage is deleted when you clear your browser data or delete your Account.</P>

      <H2 id="p7">7. Security</H2>
      <P>We implement reasonable technical and organizational measures to protect personal data against leakage, loss, damage, and unauthorized access. However, we cannot guarantee absolute security for transmission over the internet or electronic storage. You are responsible for safeguarding your credentials and device.</P>

      <H2 id="p8">8. Your Rights</H2>
      <P>Depending on applicable law (GDPR, UK GDPR, California CCPA/CPRA, Japan’s APPI, and others), you may have the right to:</P>
      <UL>
        <LI>Access (obtain disclosure of) your personal data.</LI>
        <LI>Request correction of inaccurate data.</LI>
        <LI>Request deletion (erasure) of data.</LI>
        <LI>Request restriction of, or suspension of, processing.</LI>
        <LI>Data portability (receive data in a transferable format).</LI>
        <LI>Object to processing and withdraw consent.</LI>
        <LI>For California residents, opt out of the “sale” or “sharing” of personal information (we do not sell personal information).</LI>
        <LI>Not be discriminated against for exercising your rights.</LI>
      </UL>
      <P>To exercise your rights, contact {COMPANY.emails.privacy}. We will verify your identity and respond within a reasonable period as required by law. You also have the right to lodge a complaint with a supervisory authority.</P>

      <H2 id="p9">9. Children’s Data</H2>
      <P>The Service is not directed to anyone under 18. We do not knowingly collect personal data from anyone under 18. If we learn that we have collected such data, we will delete it promptly.</P>

      <H2 id="p10">10. Cookies / Tracking</H2>
      <P>The Service uses cookies and local storage to provide functionality and improve usability. See the Cookie &amp; Storage Policy for details and controls. We may not respond uniformly to browser “Do Not Track (DNT)” signals until an industry standard is established.</P>

      <H2 id="p11">11. Changes to This Policy</H2>
      <P>We may revise this Policy as needed. For material changes, we will announce them within the Service. Continuing to use the Service after the changes constitutes acceptance of the revised Policy.</P>

      <H2 id="p12">12. Contact &amp; Data Controller</H2>
      <P>The data controller for personal data is {COMPANY.legalName}. Privacy contacts:</P>
      <UL>
        <LI>Data Protection Officer (DPO): <a href={`mailto:${COMPANY.emails.dpo}`} className="text-accent hover:underline">{COMPANY.emails.dpo}</a></LI>
        <LI>Privacy (general): <a href={`mailto:${COMPANY.emails.privacy}`} className="text-accent hover:underline">{COMPANY.emails.privacy}</a></LI>
        <LI>Address: {COMPANY.addressInline}</LI>
      </UL>
    </LegalLayout>
  )
}
