// Everything that changes when the domain and name are chosen lives here
// (plus `site` in astro.config.mjs, which reads SITE_URL below).

export const SITE_URL = 'https://stroomsom.nl';

export const SITE = {
  /** Working name; replace when the domain is chosen. */
  name: 'Stroomsom',
  url: SITE_URL,
  domain: new URL(SITE_URL).host,
  email: 'info@' + new URL(SITE_URL).host,
  tagline: 'Onafhankelijk doorgerekend: wat het einde van salderen jou kost, en wat wél loont.',
  tools: [
    { href: '/salderen-stopt-calculator', short: 'Wat kost het mij?', title: 'Wat kost het einde van salderen mij?' },
    { href: '/thuisbatterij-terugverdientijd', short: 'Loont een batterij?', title: 'Thuisbatterij: terugverdientijd berekenen' },
    { href: '/terugleverkosten-per-leverancier', short: 'Terugleverkosten', title: 'Terugleverkosten en vergoeding per leverancier (2027)' },
    { href: '/dynamisch-contract-zonnepanelen', short: 'Dynamisch contract', title: 'Dynamisch contract met zonnepanelen' },
  ],
  sameAs: [] as string[],
  /** Named maker shown on /over and in structured data. null = not shown yet. */
  author: null as null | { name: string; role: string; url?: string },
};

/**
 * Affiliate placements. Placeholders until the programs approve the site.
 * Links never carry user inputs. Only shown below results, marked "Gesponsorde link".
 */
export const AFFILIATES = {
  overstappen: { text: 'Vergelijk energiecontracten', href: '#affiliate-energie', pending: true },
  offertes: { text: 'Vraag vrijblijvend offertes aan', href: '#affiliate-offertes', pending: true },
};
