import { defineConfig } from 'astro/config';
import svelte from '@astrojs/svelte';
import sitemap from '@astrojs/sitemap';
import regels from './src/data/regels.json' with { type: 'json' };
import leveranciers from './src/data/leveranciers.json' with { type: 'json' };

// Keep in sync with SITE_URL in src/site.ts.
const SITE_URL = 'https://stroomsom.nl';
// lastmod = the newest data check date, so crawlers only see a change when figures change.
const LASTMOD = [regels.checked_at, leveranciers.checked_at].sort().at(-1);

export default defineConfig({
  site: SITE_URL,
  trailingSlash: 'never',
  build: { format: 'file' },
  integrations: [svelte(), sitemap({ serialize: (item) => ({ ...item, lastmod: LASTMOD }) })],
});
