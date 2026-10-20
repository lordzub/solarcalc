import type { APIRoute } from 'astro';
import { CHANGES } from '../lib/changes';
import { SITE } from '../site';

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export const GET: APIRoute = () => {
  const items = CHANGES.map((c, i) => `<item><title>${esc(c.change.slice(0, 90))}</title><link>${SITE.url}/wijzigingen</link><guid isPermaLink="false">${c.date}-${i}</guid><pubDate>${new Date(c.date + 'T08:00:00Z').toUTCString()}</pubDate><description>${esc(c.change)}</description></item>`).join('');
  const xml = `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>${esc(SITE.name)}: wijzigingen in tarieven en regels</title><link>${SITE.url}/wijzigingen</link><description>Wijzigingen in terugleververgoeding, terugleverkosten en regels rond salderen.</description><language>nl-nl</language>${items}</channel></rss>`;
  return new Response(xml, { headers: { 'Content-Type': 'application/rss+xml; charset=utf-8' } });
};
