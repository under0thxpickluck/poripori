import LegalLayout, { H2, P, UL, LI, Strong, Callout } from '../../components/legal/LegalLayout'
import { COMPANY } from '../../lib/company'

export default function Cookies() {
  return (
    <LegalLayout
      title="Cookie & Storage Policy"
      subtitle={`This policy explains how ${COMPANY.product} uses cookies, local storage, and similar technologies, and how you can control them. It supplements our Privacy Policy.`}
    >
      <Callout>
        {COMPANY.product} uses your browser’s <Strong>local storage</Strong> mainly to keep you signed in and to
        remember preferences such as your theme and language. Your account data — including your Virtual Point
        balance, positions, and trade history — is stored on <Strong>our servers</Strong>, not in your browser.
        Clearing your browser storage signs you out and resets local preferences, but does not delete your
        server-side account data.
      </Callout>

      <H2 id="c1">1. What These Technologies Are</H2>
      <UL>
        <LI><Strong>Cookies</Strong> are small text files stored by your browser that a site can read on later visits.</LI>
        <LI><Strong>Local storage / session storage</Strong> are browser storage mechanisms that hold larger amounts of data on your device, persisting until cleared.</LI>
        <LI><Strong>Similar technologies</Strong> include pixels and SDKs that perform comparable functions.</LI>
      </UL>

      <H2 id="c2">2. Categories We Use</H2>
      <UL>
        <LI><Strong>Strictly necessary.</Strong> Required to operate the Service — for example, keeping you signed in and storing local preferences such as your theme and settings. (Your Virtual Point balance, positions, and trade history are held on our servers, not in local storage.) These cannot be switched off without breaking the Service.</LI>
        <LI><Strong>Functional.</Strong> Remember your preferences (such as light/dark theme and filters) to improve usability.</LI>
        <LI><Strong>Analytics / performance.</Strong> Help us understand aggregate usage and improve the Service. Where required, these are used only with your consent.</LI>
      </UL>
      <P>We do not use cookies for cross-context behavioral advertising, and we do not sell information collected through these technologies.</P>

      <H2 id="c3">3. First-Party vs. Third-Party</H2>
      <P>Most storage we use is first-party (set by {COMPANY.product}). If we introduce third-party analytics or infrastructure, those providers may set their own cookies subject to their policies; we will update this document accordingly.</P>

      <H2 id="c4">4. Managing Your Choices</H2>
      <UL>
        <LI><Strong>Browser controls.</Strong> Most browsers let you view, block, or delete cookies and clear site storage in their settings. Blocking strictly necessary storage may prevent the Service from working.</LI>
        <LI><Strong>Clearing local data.</Strong> Clearing site data for {COMPANY.product} signs you out and resets local preferences; it does not delete your server-side account data (balance, positions, and trade history).</LI>
        <LI><Strong>Consent.</Strong> Where consent is required for non-essential technologies, you can grant or withdraw it through the in-service controls when available.</LI>
      </UL>

      <H2 id="c5">5. Changes</H2>
      <P>We may update this policy to reflect changes in technology or law. Material changes will be announced within the Service.</P>

      <H2 id="c6">6. Contact</H2>
      <P>Questions about this policy: <a href={`mailto:${COMPANY.emails.privacy}`} className="text-accent hover:underline">{COMPANY.emails.privacy}</a>.</P>
    </LegalLayout>
  )
}
