import data from '../data/leveranciers.json';

/** One combined log of tariff and rule changes, newest first. Add rule changes here. */
const RULE_CHANGES: { date: string; change: string }[] = [
  { date: '2026-10-20', change: 'Eerste versie van de regels: einde salderen, minimale terugleververgoeding, energiebelasting 2026 en 2027 (voorstel), btw en aanmeldplicht.' },
];

export const CHANGES = [...data.changelog, ...RULE_CHANGES].sort((a, b) => b.date.localeCompare(a.date));
