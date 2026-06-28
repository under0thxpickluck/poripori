// Shared constants for the operating company / product (used across legal docs & footer).
export const COMPANY = {
  legalName: 'LIFAI Labs, Inc.',
  shortName: 'LIFAI Labs',
  product: 'MIRAIX',
  productDesc: 'a virtual-points prediction market platform',
  addressLines: ['131 Continental Dr', 'Suite 305', 'Newark, DE 19713', 'United States'],
  addressInline: '131 Continental Dr, Suite 305, Newark, DE 19713, United States',
  incorporation: 'a Delaware corporation (C Corporation), United States',
  jurisdiction: 'the State of Delaware, United States',
  governingLaw: 'the laws of the State of Delaware, United States, excluding its conflict-of-laws rules',
  arbitrationBody: 'the American Arbitration Association (AAA)',
  arbitrationSeat: 'New Castle County, Delaware, United States',
  website: 'https://miraix.lifailabs.com',
  emails: {
    support: 'support@lifailabs.com',
    legal: 'legal@lifailabs.com',
    privacy: 'privacy@lifailabs.com',
    integrity: 'integrity@lifailabs.com',
    dpo: 'dpo@lifailabs.com',
    compliance: 'compliance@lifailabs.com',
    security: 'security@lifailabs.com',
  },
  effectiveDate: 'June 25, 2026',
  lastUpdated: 'June 25, 2026',
} as const

// Index of legal documents (used by the sidebar and hub).
export const LEGAL_INDEX: { to: string; label: string }[] = [
  { to: '/legal/terms', label: 'Terms of Service' },
  { to: '/legal/privacy', label: 'Privacy Policy' },
  { to: '/legal/cookies', label: 'Cookie & Storage Policy' },
  { to: '/legal/market-integrity', label: 'Market Integrity Policy' },
  { to: '/legal/community', label: 'Community Guidelines & Acceptable Use' },
  { to: '/legal/risk', label: 'Risk Disclosure & Disclaimers' },
  { to: '/legal/compliance', label: 'Sanctions, AML & Prohibited Jurisdictions' },
  { to: '/legal/security', label: 'Responsible Disclosure Policy' },
  { to: '/company', label: 'Company' },
  { to: '/contact', label: 'Contact' },
]
