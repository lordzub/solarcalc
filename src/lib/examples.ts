import type { Household, EvMode } from '../engine/profiles';

export interface Example {
  slug: string;
  titel: string;
  kort: string;           // short label for lists
  wie: string;            // one-line description of the household
  verbruik: number;
  opwek: number;
  panelen: number;
  huishouden: Household;
  evKwh: number;
  evMode: EvMode;
  warmtepompKwh: number;
  batterij?: 'stekker' | 'batterij5' | 'batterij10';
}

/** About 350 kWh per panel per year (Milieu Centraal: 10 panels ≈ 3.500 kWh). */
export const KWH_PER_PANEEL = 350;

export const EXAMPLES: Example[] = [
  { slug: 'appartement-6-panelen', titel: 'Appartement met 6 zonnepanelen', kort: 'Appartement, 6 panelen', wie: 'Twee personen, 1.800 kWh per jaar, 6 panelen (2.100 kWh)', verbruik: 1800, opwek: 2100, panelen: 6, huishouden: 'standaard', evKwh: 0, evMode: 'geen', warmtepompKwh: 0 },
  { slug: 'tussenwoning-10-panelen', titel: 'Tussenwoning met 10 zonnepanelen', kort: 'Tussenwoning, 10 panelen', wie: 'Gezin, 2.900 kWh per jaar, 10 panelen (3.500 kWh)', verbruik: 2900, opwek: 3500, panelen: 10, huishouden: 'standaard', evKwh: 0, evMode: 'geen', warmtepompKwh: 0 },
  { slug: 'hoekwoning-warmtepomp', titel: 'Hoekwoning met warmtepomp en 14 panelen', kort: 'Hoekwoning met warmtepomp', wie: '2.900 kWh huishouden plus 2.100 kWh warmtepomp, 14 panelen (4.900 kWh)', verbruik: 2900, opwek: 4900, panelen: 14, huishouden: 'standaard', evKwh: 0, evMode: 'geen', warmtepompKwh: 2100 },
  { slug: 'gezin-elektrische-auto', titel: 'Gezin met elektrische auto die overdag laadt', kort: 'Gezin met elektrische auto', wie: '3.200 kWh huishouden plus 2.500 kWh auto overdag, 12 panelen (4.200 kWh)', verbruik: 3200, opwek: 4200, panelen: 12, huishouden: 'overdag-thuis', evKwh: 2500, evMode: 'overdag', warmtepompKwh: 0 },
  { slug: 'overdag-zelden-thuis', titel: 'Overdag zelden thuis, 10 panelen', kort: 'Overdag zelden thuis', wie: 'Twee werkenden, 2.500 kWh per jaar, 10 panelen (3.500 kWh)', verbruik: 2500, opwek: 3500, panelen: 10, huishouden: 'zelden-thuis', evKwh: 0, evMode: 'geen', warmtepompKwh: 0 },
  { slug: 'stekkerbatterij-2-7-kwh', titel: 'Stekkerbatterij van 2,7 kWh in een tussenwoning', kort: 'Stekkerbatterij 2,7 kWh', wie: 'De tussenwoning (2.900 kWh, 10 panelen) met een stekkerbatterij van 2,7 kWh en 800 W', verbruik: 2900, opwek: 3500, panelen: 10, huishouden: 'standaard', evKwh: 0, evMode: 'geen', warmtepompKwh: 0, batterij: 'stekker' },
  { slug: 'batterij-5-kwh', titel: 'Batterij van 5 kWh in een tussenwoning', kort: 'Batterij 5 kWh', wie: 'De tussenwoning (2.900 kWh, 10 panelen) met een batterij van 5 kWh en 2,5 kW', verbruik: 2900, opwek: 3500, panelen: 10, huishouden: 'standaard', evKwh: 0, evMode: 'geen', warmtepompKwh: 0, batterij: 'batterij5' },
  { slug: 'vaste-batterij-10-kwh', titel: 'Vaste thuisbatterij van 10 kWh in een tussenwoning', kort: 'Vaste batterij 10 kWh', wie: 'De tussenwoning (2.900 kWh, 10 panelen) met een vaste batterij van 10 kWh, inclusief installatie', verbruik: 2900, opwek: 3500, panelen: 10, huishouden: 'standaard', evKwh: 0, evMode: 'geen', warmtepompKwh: 0, batterij: 'batterij10' },
];
