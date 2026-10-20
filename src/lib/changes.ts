import data from '../data/leveranciers.json';

/** One combined log of tariff and rule changes, newest first. Add rule changes here. */
const RULE_CHANGES: { date: string; change: string }[] = [
  { date: '2026-10-21', change: 'Correcties na een onafhankelijke controle: het wettelijke minimum voor de terugleververgoeding is 50% van de kale leveringsprijs zonder btw (eerder rekenden we met btw); de batterij van 5 kWh is inclusief een eigen groep (€ 1.650); standaard terugleverkosten 2026 nu € 0,146 per kWh; de dubbele energiebelasting is bijgewerkt met de kabinetsbelofte van 16 oktober 2026; de aanmeldplicht voor batterijen geldt sinds juli 2022.' },
  { date: '2026-10-20', change: 'Eerste versie van de regels: einde salderen, minimale terugleververgoeding, energiebelasting 2026 en 2027 (voorstel), btw en aanmeldplicht.' },
];

export const CHANGES = [...data.changelog, ...RULE_CHANGES].sort((a, b) => b.date.localeCompare(a.date));
