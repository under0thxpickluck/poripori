import LegalLayout, { H2, P, UL, OL, LI, Strong, Callout } from '../../components/legal/LegalLayout'
import { COMPANY } from '../../lib/company'

export default function Terms() {
  return (
    <LegalLayout
      title="Terms of Service"
      subtitle={`These Terms of Service (the “Terms”) govern your access to and use of “${COMPANY.product},” a prediction market platform operated by ${COMPANY.legalName} (“${COMPANY.shortName},” “we,” “us,” or “our”). By accessing or using the service (the “Service”), you agree to be bound by these Terms.`}
    >
      <Callout tone="warn">
        <Strong>Important.</Strong> The Service uses <Strong>virtual points only</Strong> for educational and
        entertainment purposes. You cannot wager money, cryptocurrency, or anything of monetary value, and virtual
        points cannot be redeemed, withdrawn, or sold or transferred for value. Virtual points have no monetary
        value. The Service is not intended to constitute gambling, a financial instrument, securities trading, or
        commodity futures of any kind.
      </Callout>

      <H2 id="art1">1. Definitions</H2>
      <UL>
        <LI><Strong>“Service”</Strong> means the {COMPANY.product} websites, applications, features, and related services operated by us.</LI>
        <LI><Strong>“User,” “you”</Strong> means any individual who accesses or uses the Service under these Terms.</LI>
        <LI><Strong>“Account”</Strong> means the identifier you register to use the Service.</LI>
        <LI><Strong>“Virtual Points” (pt)</Strong> means the in-service unit of account that has no monetary or financial value.</LI>
        <LI><Strong>“Market”</Strong> means a unit of the prediction market in which users take “YES/NO” positions on the outcome of a future event.</LI>
        <LI><Strong>“Resolution”</Strong> means determining the outcome of a Market after its deadline under the applicable resolution process.</LI>
        <LI><Strong>“Content”</Strong> means any information transmitted through the Service, including Market questions and descriptions, comments, and images.</LI>
      </UL>

      <H2 id="art2">2. Acceptance &amp; Scope</H2>
      <OL>
        <LI>These Terms apply to all use of the Service by you.</LI>
        <LI>All policies posted within the Service (including the Privacy Policy, Cookie &amp; Storage Policy, Market Integrity Policy, Community Guidelines &amp; Acceptable Use Policy, Risk Disclosure &amp; Disclaimers, and the Sanctions, AML &amp; Prohibited Jurisdictions Policy) form part of, and are incorporated into, these Terms.</LI>
        <LI>If these Terms conflict with a specific policy, the specific policy controls for the matter it addresses.</LI>
      </OL>

      <H2 id="art3">3. Eligibility</H2>
      <OL>
        <LI>You represent and warrant that you are at least 18 years old and that your use of the Service is not prohibited under the laws of your country or place of residence.</LI>
        <LI>You may not use the Service if you have previously been suspended for a breach of these Terms, or if you are a person or located in a region designated as restricted under our Sanctions, AML &amp; Prohibited Jurisdictions Policy.</LI>
        <LI>Use by entities or via automated means (e.g., bots) is not permitted without our prior written consent.</LI>
      </OL>

      <H2 id="art4">4. Accounts</H2>
      <OL>
        <LI>You agree to register with accurate, current information and to keep it up to date.</LI>
        <LI>You are responsible for safeguarding your credentials and must not let any third party use, or lend, transfer, or share, your Account.</LI>
        <LI>All activity conducted through your Account is deemed to be your own.</LI>
        <LI>Operating multiple Accounts (multi-accounting) is prohibited except as expressly permitted under Section 8 and the Market Integrity Policy.</LI>
      </OL>

      <H2 id="art5">5. Virtual Points</H2>
      <OL>
        <LI>Virtual Points are a unit of account used solely to record forecasts and trades within the Service. They are <Strong>not legal tender, electronic money, a prepaid payment instrument, cryptocurrency, or anything of monetary value.</Strong></LI>
        <LI>Virtual Points are not redeemable, refundable, withdrawable, interest-bearing, transferable for value, or inheritable.</LI>
        <LI>We may grant, adjust, expire, or correct Virtual Point balances to a reasonable extent as necessary to operate the Service.</LI>
        <LI>We may reverse Virtual Points obtained through fraud, error, or malfunction.</LI>
      </OL>

      <H2 id="art6">6. Markets — Creation, Participation &amp; Resolution</H2>
      <OL>
        <LI>You may propose Markets, participate (buy/sell YES or NO), and post comments in accordance with the features of the Service.</LI>
        <LI>Markets you propose are published only after our review and approval. We may decline to approve a proposal, or unpublish a Market after publication, for any reason.</LI>
        <LI>Resolution follows the criteria and procedures in the Market Integrity Policy. Settlement of Virtual Points to winning positions is based on the Resolution outcome.</LI>
        <LI>Where Resolution becomes impractical due to uncertainty of the event, a change in source data, force majeure, or similar circumstances, we may void the Market or settle it by reasonable means (including reversing trades and restoring balances).</LI>
        <LI>Market prices are set by an automated market maker using the Logarithmic Market Scoring Rule (LMSR). Prices fluctuate continuously based on others’ trades, and we do not guarantee any particular price, execution, or profit.</LI>
      </OL>

      <H2 id="art7">7. Fees</H2>
      <P>The Service does not currently charge Users. If we introduce paid features in the future, we will clearly present the terms within the Service and provide any legally required disclosures before offering them. No monetary charge will arise without your express consent.</P>

      <H2 id="art8">8. Prohibited Conduct</H2>
      <P>You must not engage in any of the following. Details are set out in the Market Integrity Policy and the Community Guidelines &amp; Acceptable Use Policy.</P>
      <UL>
        <LI>Violating any law, these Terms, or public order and morals.</LI>
        <LI>Market manipulation, spoofing, wash trading, collusion, abusive multi-accounting, or any other conduct harming market integrity.</LI>
        <LI>Improperly using material non-public information that affects Resolution.</LI>
        <LI>Manipulating, or attempting to manipulate, Resolution outcomes.</LI>
        <LI>Exploiting vulnerabilities or bugs, or accessing the Service without authorization.</LI>
        <LI>Excessive automated access, scraping, or reverse engineering.</LI>
        <LI>Infringing the intellectual property, privacy, reputation, or other rights of others or us.</LI>
        <LI>Posting unlawful, harmful, discriminatory, obscene, or violent Content.</LI>
        <LI>Money laundering, terrorist financing, sanctions evasion, or other activity involving illicit funds.</LI>
        <LI>Any other conduct we reasonably deem inappropriate.</LI>
      </UL>

      <H2 id="art9">9. Content &amp; Intellectual Property</H2>
      <OL>
        <LI>The Service and its software, design, trademarks, logos, and text are owned by us or our licensors.</LI>
        <LI>You retain copyright in Content you post. You grant us a worldwide, non-exclusive, royalty-free, sublicensable license to use (including to reproduce, publicly transmit, modify, and translate) that Content for the purpose of operating, improving, and promoting the Service.</LI>
        <LI>You warrant that you hold the necessary rights to your Content and that it does not infringe the rights of any third party.</LI>
        <LI>We may remove or hide Content we believe violates these Terms or any policy, without prior notice.</LI>
      </OL>

      <H2 id="art10">10. Notice of Infringement (DMCA)</H2>
      <P>If you believe Content on the Service infringes your rights, contact {COMPANY.emails.legal} with an identification of the Content, the basis of your rights, your contact details, and a statement as to accuracy. We will investigate within reason and take appropriate action, including removal. We also follow procedures consistent with the U.S. Digital Millennium Copyright Act (DMCA) notice-and-counter-notice process.</P>

      <H2 id="art11">11. Changes, Suspension &amp; Termination of the Service</H2>
      <OL>
        <LI>We may change, add to, or discontinue all or part of the Service without prior notice to you.</LI>
        <LI>We may suspend or stop the Service for maintenance, failures, force majeure, or other operational needs.</LI>
        <LI>Except as otherwise provided in these Terms, we are not liable for any loss to you or third parties arising from the foregoing.</LI>
      </OL>

      <H2 id="art12">12. Suspension &amp; Account Deletion</H2>
      <OL>
        <LI>If you breach these Terms or any policy, are reasonably suspected of doing so, or where otherwise necessary, we may, without prior notice, remove Content, restrict features, and suspend, freeze, or delete your Account.</LI>
        <LI>We are not liable if Virtual Points or other data are lost as a result of such measures.</LI>
        <LI>You may delete your Account (close your membership) at any time through the methods provided in the Service.</LI>
      </OL>

      <H2 id="art13">13. Disclaimer of Warranties</H2>
      <P>
        The Service is provided <Strong>“AS IS” and “AS AVAILABLE.”</Strong> To the fullest extent permitted by law,
        we disclaim all warranties, express or implied, including merchantability, fitness for a particular purpose,
        title, non-infringement, accuracy, completeness, continuity, and that the Service will be uninterrupted,
        error-free, or free of viruses. We do not warrant Resolution outcomes, prices, or the accuracy of any
        information.
      </P>

      <H2 id="art14">14. Limitation of Liability</H2>
      <OL>
        <LI>We are not liable for any indirect, special, consequential, incidental, or punitive damages, or lost profits, arising in connection with the Service, whether or not foreseeable.</LI>
        <LI>To the fullest extent permitted by law, our aggregate liability to you is <Strong>limited to one hundred U.S. dollars (US$100)</Strong> or the equivalent, reflecting that the Service is provided free of charge.</LI>
        <LI>These limitations do not apply to our willful misconduct or gross negligence, or where limitation is not permitted by applicable law.</LI>
      </OL>

      <H2 id="art15">15. Indemnification</H2>
      <P>You will indemnify and hold harmless {COMPANY.shortName}, its officers, employees, agents, and partners from and against any claims, damages, losses, liabilities, and expenses (including reasonable attorneys’ fees) arising out of or relating to (i) your use of the Service, (ii) your breach of these Terms or any policy, (iii) your Content, or (iv) your infringement of any third-party right.</P>

      <H2 id="art16">16. Third-Party Services &amp; Links</H2>
      <P>The Service may include links to third-party services and external sources used as references for Resolution. We are not responsible for the content, accuracy, or availability of such third-party services. You use them at your own risk.</P>

      <H2 id="art17">17. Governing Law, Disputes &amp; Arbitration</H2>
      <OL>
        <LI>These Terms and your use of the Service are governed by and construed in accordance with {COMPANY.governingLaw}.</LI>
        <LI>Any dispute arising out of or relating to these Terms will first be addressed through good-faith negotiation. If unresolved, it will be finally settled by binding arbitration administered by {COMPANY.arbitrationBody} with a seat in {COMPANY.arbitrationSeat}.</LI>
        <LI><Strong>Class action waiver.</Strong> To the extent permitted by law, you agree to resolve disputes only on an individual basis, and not as part of any class, collective, or representative proceeding.</LI>
        <LI>Nothing in this Section limits any rights you may have under mandatory consumer-protection laws that cannot be waived; such laws apply to the extent they are mandatory for you.</LI>
      </OL>

      <H2 id="art18">18. Changes to These Terms</H2>
      <OL>
        <LI>We may amend these Terms as needed. For material changes, we will announce the updated content and effective date within the Service.</LI>
        <LI>If you continue to use the Service after the effective date, you are deemed to have accepted the amended Terms.</LI>
      </OL>

      <H2 id="art19">19. Notices</H2>
      <P>Notices from us to you may be given by posting within the Service, by sending to your registered contact details, or by any other method we deem appropriate. You may contact us at {COMPANY.emails.support} (general) or {COMPANY.emails.legal} (legal).</P>

      <H2 id="art20">20. Severability, Entire Agreement, No Waiver &amp; Assignment</H2>
      <OL>
        <LI>If any provision of these Terms is held invalid or unenforceable, the remaining provisions remain in effect.</LI>
        <LI>These Terms and the policies constitute the entire agreement between the parties regarding the Service.</LI>
        <LI>Our failure to exercise any right does not waive it.</LI>
        <LI>You may not assign your rights or obligations under these Terms without our prior written consent. We may assign or transfer them in connection with a merger, acquisition, or sale of assets.</LI>
      </OL>

      <H2 id="art21">21. Language</H2>
      <P>These Terms are issued in English as the authoritative version. Translations may be provided for convenience; in case of any discrepancy, the English version prevails.</P>
    </LegalLayout>
  )
}
