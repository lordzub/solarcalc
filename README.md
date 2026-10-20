# Stroomsom (working name)

Independent Dutch calculators about the end of the salderingsregeling on 1 January 2027: what it costs a household, whether a home battery pays back, and which supplier pays most for feed-in. Astro + Svelte, static HTML, all calculations in the browser.

| Page | What it does |
|---|---|
| `/salderen-stopt-calculator` | Cost with vs without saldering, ranked options (shift use, switch supplier, three batteries) |
| `/thuisbatterij-terugverdientijd` | Battery payback with your own house and battery, sensitivity table |
| `/terugleverkosten-per-leverancier` | Net feed-in value per supplier with date and source per row, changelog |
| `/voorbeeld/*` | 8 worked examples (pre-rendered, citable) |
| `/regels-2027`, explainers | Rules with status and source; dynamic contract, double energy tax, VAT, safety, registration |

## Commands

```sh
npm install
npm run dev     # local dev server
npm test        # golden + property tests
npm run build   # static site in dist/
```

## How it works

- **`src/engine/profiles.ts`**: hourly model profiles for one year (8760 h). Solar from sun position over De Bilt with seeded daily weather, scaled to monthly shares; household use with daily/weekly/seasonal patterns; EV and heat pump. Calibrated to Milieu Centraal: ~15 kWh on a June day and ~2.5 kWh on a December day for 3,500 kWh/yr; ~30% self-consumption without a battery, >50% with one. **Not** the official MFFBAS/NEDU profiles yet (phase 2).
- **`src/engine/sim.ts`**: per-hour self-consumption, load shifting, greedy battery dispatch with round-trip loss and standby.
- **`src/engine/costs.ts`**: cost with saldering (net metering + 2026 terugleverkosten) vs without (import × all-in price − export × net feed-in), options, payback with degradation, verdicts. Fixed costs, grid fees and the energy tax reduction cancel out and are excluded.
- **`src/data/regels.json`**, **`src/data/leveranciers.json`**: every rule and tariff with `status`, `source`, `checked_at`. Updating figures = editing these files.
- **`tests/reference/reference.py`**: independent Python implementation with values typed from the research brief; generates `tests/golden.json` (18 cases). `npm test` must match it to the cent.

### Updating tariffs or rules

1. Edit the JSON in `src/data/` (update `checked_at`, add a `changelog` entry for supplier changes, or a line in `src/lib/changes.ts` for rule changes).
2. If a value used by the reference changes, update `tests/reference/reference.py` from the source, then `python3 tests/reference/reference.py > tests/golden.json`.
3. `npm test && npm run build`. The sitemap `lastmod` follows the newest `checked_at`.

## Choosing the domain

Change it in two places: `SITE_URL` in `src/site.ts` and in `astro.config.mjs`, plus the `Sitemap:` line in `public/robots.txt`. The working name is `SITE.name` in `src/site.ts`. Then set the GitHub repository variable `SITE_HOST` (e.g. `example.nl`) to switch on the IndexNow workflow.

## Deploying (Cloudflare Workers/Pages, same as zzpreken)

- Build command `npm run build`, output directory `dist`, env `NODE_VERSION=22`
- Optional `PUBLIC_CF_BEACON` for Cloudflare Web Analytics (cookieless)
- Cloudflare AI Crawl Control: Search, Agent and Training on Allow; Bot Fight Mode off; managed robots.txt off

## Phase 2

- Official MFFBAS/NEDU quarter-hour profiles, and P1/CSV upload parsed in the browser
- Dynamic contract simulation on a year of ENTSO-E day-ahead prices (request an API token first)
- Final 2027 energy tax (Belastingdienst, December) and grid tariffs (ACM, Nov/Dec)
- Affiliate links (placeholders in `src/site.ts`) once programs approve
