import type { APIRoute } from 'astro';
import { SITE } from '../site';
import { EXAMPLES } from '../lib/examples';
import { runScenario, DEFAULTS, R, CONTRACTS, netto } from '../engine/costs';
import regels from '../data/regels.json';

export const GET: APIRoute = () => {
  const b = SITE.url;
  const r = runScenario(DEFAULTS);
  const best = CONTRACTS[0], worst = CONTRACTS[CONTRACTS.length - 1];
  const c = (v: number) => (v * 100).toLocaleString('nl-NL', { maximumFractionDigits: 2 });
  const lines = [
    `# ${SITE.name}`,
    '',
    `> ${SITE.tagline} Onafhankelijke rekenhulpen over het einde van de salderingsregeling in Nederland (1 januari 2027), thuisbatterijen en terugleverkosten. Geen verkoper. Elk cijfer heeft een status (definitief, voorlopig, voorstel) en een bron. Laatst gecontroleerd: ${regels.checked_at}.`,
    '',
    `Kernfeiten: salderen stopt op 1 januari 2027 (Stb. 2025, 17). Terugleververgoeding minimaal 50% van de kale leveringsprijs tot 2030. Netto terugleververgoeding 1-jarig vast 2027: ${c(netto(worst))} tot ${c(netto(best))} cent per kWh (hoogste: ${best.name}). Energiebelasting stroom 2027: € ${R.energiebelasting2027.value} per kWh excl. btw (voorstel). Een tussenwoning met 2.900 kWh verbruik en 10 panelen betaalt vanaf 2027 ongeveer € ${Math.round(r.verschil)} per jaar meer.`,
    '',
    '## Rekenhulpen',
    ...SITE.tools.map((t) => `- [${t.title}](${b}${t.href})`),
    '',
    '## Vooraf invullen',
    `- ${b}/salderen-stopt-calculator?verbruik=3500&panelen=12&leverancier=Eneco`,
    `- ${b}/thuisbatterij-terugverdientijd?verbruik=2900&panelen=10&kwh=5&kw=2.5&bprijs=1250`,
    '',
    '## Rekenvoorbeelden',
    ...EXAMPLES.map((e) => `- [${e.titel}](${b}/voorbeeld/${e.slug})`),
    '',
    '## Regels en data',
    `- [Alle regels en bedragen 2027](${b}/regels-2027) ([JSON](${b}/data/regels-2027.json))`,
    `- [Terugleverkosten per leverancier](${b}/terugleverkosten-per-leverancier) ([JSON](${b}/data/leveranciers-teruglevering.json))`,
    `- [Dubbele energiebelasting](${b}/dubbele-energiebelasting)`,
    `- [Btw op een thuisbatterij](${b}/btw-thuisbatterij)`,
    `- [Veiligheid](${b}/thuisbatterij-veiligheid)`,
    `- [Zo rekenen we](${b}/zo-rekenen-we)`,
    '',
  ];
  return new Response(lines.join('\n'), { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
};
