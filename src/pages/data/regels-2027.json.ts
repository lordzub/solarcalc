import type { APIRoute } from 'astro';
import regels from '../../data/regels.json';
import { SITE } from '../../site';
export const GET: APIRoute = () => new Response(JSON.stringify({
  name: 'Regels en bedragen salderen 2027', publisher: `${SITE.name} (${SITE.url})`,
  license: 'CC BY 4.0, https://creativecommons.org/licenses/by/4.0/', documentation: `${SITE.url}/open-data`, ...regels,
}, null, 2), { headers: { 'Content-Type': 'application/json; charset=utf-8' } });
