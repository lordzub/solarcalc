import type { APIRoute } from 'astro';
import data from '../../data/leveranciers.json';
import { SITE } from '../../site';
export const GET: APIRoute = () => new Response(JSON.stringify({
  name: 'Terugleververgoeding en terugleverkosten 2027 per leverancier', publisher: `${SITE.name} (${SITE.url})`,
  license: 'CC BY 4.0, https://creativecommons.org/licenses/by/4.0/', documentation: `${SITE.url}/open-data`, unit: 'eurocent per kWh incl. btw', ...data,
}, null, 2), { headers: { 'Content-Type': 'application/json; charset=utf-8' } });
