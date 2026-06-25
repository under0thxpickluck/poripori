import LegalLayout, { H2, P, UL, LI, Strong } from '../components/legal/LegalLayout'
import { COMPANY } from '../lib/company'

export default function Company() {
  return (
    <LegalLayout
      title="Company"
      subtitle={`${COMPANY.product} is operated by ${COMPANY.legalName}.`}
    >
      <H2 id="co1">About {COMPANY.shortName}</H2>
      <P>
        {COMPANY.legalName} builds tools that turn collective knowledge into clear, real-time signals. Our flagship
        product, {COMPANY.product}, is {COMPANY.productDesc} where people forecast future events and see probabilities
        move as the community trades — using virtual points, with no real-money risk.
      </P>

      <H2 id="co2">Mission</H2>
      <P>
        We believe markets are one of the best ways humans have to aggregate information. Our mission is to make that
        power accessible, transparent, and fun — and to do it responsibly, with strong integrity and privacy
        protections at the core.
      </P>

      <H2 id="co3">Corporate Information</H2>
      <UL>
        <LI><Strong>Legal name:</Strong> {COMPANY.legalName}</LI>
        <LI><Strong>Entity:</Strong> {COMPANY.incorporation}</LI>
        <LI><Strong>Registered office:</Strong> {COMPANY.addressInline}</LI>
        <LI><Strong>Product:</Strong> {COMPANY.product} — {COMPANY.productDesc}</LI>
        <LI><Strong>Website:</Strong> <a href={COMPANY.website} className="text-accent hover:underline">{COMPANY.website}</a></LI>
        <LI><Strong>Governing law:</Strong> {COMPANY.governingLaw}</LI>
      </UL>

      <H2 id="co4">Contact</H2>
      <UL>
        <LI>General &amp; support: <a href={`mailto:${COMPANY.emails.support}`} className="text-accent hover:underline">{COMPANY.emails.support}</a></LI>
        <LI>Legal: <a href={`mailto:${COMPANY.emails.legal}`} className="text-accent hover:underline">{COMPANY.emails.legal}</a></LI>
        <LI>Privacy: <a href={`mailto:${COMPANY.emails.privacy}`} className="text-accent hover:underline">{COMPANY.emails.privacy}</a></LI>
        <LI>Press &amp; partnerships: <a href={`mailto:${COMPANY.emails.support}`} className="text-accent hover:underline">{COMPANY.emails.support}</a></LI>
      </UL>

      <H2 id="co5">Important Notice</H2>
      <P>
        {COMPANY.product} is for education and entertainment and uses virtual points only. It is not a real-money
        trading, gambling, or investment service. See our Risk Disclosure &amp; Disclaimers and Terms of Service for
        details.
      </P>
    </LegalLayout>
  )
}
