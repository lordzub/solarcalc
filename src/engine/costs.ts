import regels from '../data/regels.json';
import leveranciers from '../data/leveranciers.json';
import { buildProfiles, type ProfileInput, type Profiles } from './profiles';
import { simulate, eigenverbruik, type Battery, type SimResult } from './sim';

export const R = regels.rules;
const VAT = R.btw.value;

export interface Contract {
  naam: string;
  vergoeding: number; // €/kWh incl. VAT paid to you per fed-in kWh (2027)
  kosten: number;     // €/kWh incl. VAT terugleverkosten (2027)
}

export const CONTRACTS: Contract[] = leveranciers.fixed
  .map((l) => ({ naam: l.name, vergoeding: l.vergoeding / 100, kosten: l.kosten / 100 }))
  .sort((a, b) => b.vergoeding - b.kosten - (a.vergoeding - a.kosten));

export const netto = (c: Contract) => c.vergoeding - c.kosten;
export const contractByName = (n: string) => CONTRACTS.find((c) => c.naam === n);

export interface Prices {
  stroomprijs: number;          // €/kWh all-in incl. energy tax and VAT
  terugleverkosten2026: number; // €/kWh incl. VAT, on fed-in kWh in 2026 (with saldering)
  contract: Contract;
}

/** Kale leveringsprijs excl. VAT and energy tax, derived from the all-in price (2027 energy tax). */
export const kalePrijs = (allIn: number) => Math.max(0, allIn / (1 + VAT) - R.energiebelasting2027.value);
/** Statutory floor for the feed-in compensation, incl. VAT (50% of the kale price). */
export const minimumVergoeding = (allIn: number) => kalePrijs(allIn) * R.minimumVergoeding.value * (1 + VAT);

/** Variable electricity cost with saldering (rules up to 2026), same prices. */
export function kostenMetSalderen(r: SimResult, p: Prices): number {
  const net = r.afname - r.teruglevering;
  const energy = net >= 0 ? net * p.stroomprijs : net * p.contract.vergoeding; // surplus paid at feed-in rate
  return energy + r.teruglevering * p.terugleverkosten2026;
}

/** Variable electricity cost without saldering (from 1 January 2027). */
export function kostenZonderSalderen(r: SimResult, p: Prices): number {
  return r.afname * p.stroomprijs - r.teruglevering * netto(p.contract);
}

export interface Option {
  key: 'niets' | 'verschuiven' | 'overstappen' | 'stekker' | 'batterij5' | 'batterij10';
  label: string;
  investering: number;
  besparing: number;         // € per year vs doing nothing (2027)
  terugverdientijd: number | null;
  levensduur: number | null;
  oordeel: 'loont' | 'twijfel' | 'loont-niet' | 'gratis' | 'basis';
  toelichting: string;
}

export interface BatteryOffer extends Battery { prijs: number; levensduur: number; degradatie: number; label: string }

/** Example batteries; prices October 2026 (see the research brief). */
export const BATTERIES: Record<'stekker' | 'batterij5' | 'batterij10', BatteryOffer> = {
  stekker: { label: 'Stekkerbatterij 2,7 kWh (800 W)', capaciteit: 2.7, vermogen: 0.8, rendement: 0.88, standby: 10, prijs: 1195, levensduur: 10, degradatie: 0.02 },
  batterij5: { label: 'Batterij 5 kWh (2,5 kW, zelf aansluiten)', capaciteit: 5.12, vermogen: 2.5, rendement: 0.88, standby: 15, prijs: 1250, levensduur: 10, degradatie: 0.02 },
  batterij10: { label: 'Vaste batterij 10 kWh, incl. installatie', capaciteit: 10, vermogen: 3.7, rendement: 0.9, standby: 25, prijs: 5500, levensduur: 15, degradatie: 0.015 },
};

export function oordeel(payback: number | null, lifetime: number): Option['oordeel'] {
  if (payback == null) return 'loont-niet';
  if (payback <= lifetime * 0.67) return 'loont';
  if (payback <= lifetime) return 'twijfel';
  return 'loont-niet';
}

/** Total net result over the lifetime, with savings shrinking by `degr` per year. */
export function levensduurResultaat(saving: number, price: number, years: number, degr: number): number {
  let total = 0;
  for (let y = 0; y < years; y++) total += saving * Math.pow(1 - degr, y);
  return total - price;
}

/** Simple payback including degradation: first year in which cumulative savings reach the price. */
export function terugverdientijd(saving: number, price: number, degr: number, maxYears = 40): number | null {
  if (saving <= 0) return null;
  let cum = 0;
  for (let y = 0; y < maxYears; y++) {
    const s = saving * Math.pow(1 - degr, y);
    if (cum + s >= price) return y + (price - cum) / s;
    cum += s;
  }
  return null;
}

export interface Scenario extends ProfileInput {
  stroomprijs: number;
  terugleverkosten2026: number;
  contract: Contract;
  verschuifbaar: number; // share of daily use that can move to solar hours, 0..0.3
}

export interface ScenarioResult {
  basis: SimResult;
  metSalderen: number;
  zonderSalderen: number;
  verschil: number;
  eigenverbruik: number;
  opties: Option[];
  besteContract: Contract;
  minimumVergoeding: number;
}

export const SHIFT_DEFAULT = 0.1;

export function runScenario(s: Scenario, profiles?: Profiles): ScenarioResult {
  const prof = profiles ?? buildProfiles(s);
  const p: Prices = { stroomprijs: s.stroomprijs, terugleverkosten2026: s.terugleverkosten2026, contract: s.contract };
  const basis = simulate(prof, null, 0);
  const met = kostenMetSalderen(basis, p);
  const zonder = kostenZonderSalderen(basis, p);

  const opties: Option[] = [{
    key: 'niets', label: 'Niets doen', investering: 0, besparing: 0, terugverdientijd: null, levensduur: null, oordeel: 'basis',
    toelichting: `Vanaf 2027 betaal je ${Math.round(zonder - met)} euro per jaar meer dan met salderen.`,
  }];

  const shareShift = s.verschuifbaar > 0 ? s.verschuifbaar : SHIFT_DEFAULT;
  const shifted = simulate(prof, null, shareShift);
  opties.push({
    key: 'verschuiven', label: `Verbruik verschuiven (${Math.round(shareShift * 100)}% van je dagverbruik)`, investering: 0,
    besparing: zonder - kostenZonderSalderen(shifted, p), terugverdientijd: 0, levensduur: null, oordeel: 'gratis',
    toelichting: 'Wasmachine, vaatwasser, droger of auto laden als de zon schijnt. Kost niets.',
  });

  const best = CONTRACTS[0];
  if (netto(best) > netto(s.contract) + 1e-9) {
    opties.push({
      key: 'overstappen', label: `Overstappen naar ${best.naam} (hoogste netto vergoeding)`, investering: 0,
      besparing: basis.teruglevering * (netto(best) - netto(s.contract)), terugverdientijd: 0, levensduur: null, oordeel: 'gratis',
      toelichting: 'Alleen het teruglever-deel; vergelijk ook de leveringsprijs.',
    });
  }

  for (const key of ['stekker', 'batterij5', 'batterij10'] as const) {
    const b = BATTERIES[key];
    const r = simulate(prof, b, 0);
    const saving = zonder - kostenZonderSalderen(r, p);
    const tvt = terugverdientijd(saving, b.prijs, b.degradatie);
    opties.push({
      key, label: b.label, investering: b.prijs, besparing: saving, terugverdientijd: tvt, levensduur: b.levensduur,
      oordeel: oordeel(tvt, b.levensduur),
      toelichting: `Eigen verbruik stijgt naar ${Math.round(eigenverbruik(r) * 100)}%.`,
    });
  }

  return {
    basis, metSalderen: met, zonderSalderen: zonder, verschil: zonder - met, eigenverbruik: eigenverbruik(basis),
    opties, besteContract: best, minimumVergoeding: minimumVergoeding(s.stroomprijs),
  };
}

export interface BatteryScenario extends Scenario { batterij: BatteryOffer }

export interface BatteryResult {
  zonder: SimResult;
  met: SimResult;
  besparing: number;
  terugverdientijd: number | null;
  resultaat: number;
  oordeel: Option['oordeel'];
  eigenZonder: number;
  eigenMet: number;
  cycli: number;
}

export function runBattery(s: BatteryScenario, profiles?: Profiles): BatteryResult {
  const prof = profiles ?? buildProfiles(s);
  const p: Prices = { stroomprijs: s.stroomprijs, terugleverkosten2026: s.terugleverkosten2026, contract: s.contract };
  const zonder = simulate(prof, null, s.verschuifbaar);
  const met = simulate(prof, s.batterij, s.verschuifbaar);
  const besparing = kostenZonderSalderen(zonder, p) - kostenZonderSalderen(met, p);
  const tvt = terugverdientijd(besparing, s.batterij.prijs, s.batterij.degradatie);
  return {
    zonder, met, besparing, terugverdientijd: tvt,
    resultaat: levensduurResultaat(besparing, s.batterij.prijs, s.batterij.levensduur, s.batterij.degradatie),
    oordeel: oordeel(tvt, s.batterij.levensduur),
    eigenZonder: eigenverbruik(zonder), eigenMet: eigenverbruik(met),
    cycli: s.batterij.capaciteit > 0 ? met.uitBatterij / s.batterij.capaciteit : 0,
  };
}

/** Defaults used for pre-rendered results and the calculators' first view. */
export const DEFAULTS: Scenario = {
  verbruik: 2900, opwek: 3500, huishouden: 'standaard', evKwh: 0, evMode: 'geen', warmtepompKwh: 0,
  stroomprijs: R.stroomprijs2027.value, terugleverkosten2026: R.terugleverkosten2026.value,
  contract: CONTRACTS.find((c) => c.naam === 'Vattenfall') ?? CONTRACTS[0], verschuifbaar: 0,
};
