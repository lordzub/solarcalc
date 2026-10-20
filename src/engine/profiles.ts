// Model profiles for one year (2027, 8760 hours, local clock time incl. summer time).
//
// These are NOT the official MFFBAS/NEDU standard profiles (not available to this build);
// they are model profiles calibrated to published anchors:
//  - Milieu Centraal: 10 panels ≈ 3.500 kWh/yr, ≈ 15 kWh on an average June day and
//    ≈ 2,5 kWh on an average December day; ≈ 30% self-consumption without a battery.
// Everything is deterministic (seeded), so results are reproducible and testable.

export const HOURS = 8760;
export const DAYS = 365;
const LAT = (52.1 * Math.PI) / 180; // De Bilt
const LON = 5.2; // degrees east

/** Share of the yearly solar yield per month, south ~35°, the Netherlands (normalised in code). */
export const PV_MONTH_SHARE = [2.6, 4.6, 8.0, 11.5, 13.4, 13.3, 13.2, 11.6, 9.0, 6.3, 3.3, 2.0];
const MONTH_DAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
// 2027: summer time from 28 March (day 86) to 31 October (day 303), both 0-based day-of-year.
const DST_START = 86, DST_END = 303;

export type Household = 'standaard' | 'overdag-thuis' | 'zelden-thuis';
export type EvMode = 'geen' | 'avond' | 'overdag';

export interface ProfileInput {
  verbruik: number;          // yearly household use excl. EV and heat pump, kWh
  opwek: number;             // yearly solar yield, kWh
  huishouden: Household;
  evKwh: number;             // extra yearly EV charging, kWh
  evMode: EvMode;
  warmtepompKwh: number;     // extra yearly heat pump use, kWh
}

export const monthOfDay = (d: number) => {
  let acc = 0;
  for (let m = 0; m < 12; m++) { acc += MONTH_DAYS.at(m)!; if (d < acc) return m; }
  return 11;
};

/** Deterministic pseudo-random generator (mulberry32). */
export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Sun elevation factor (0..1) for day d at local clock hour h (centre of the hour). */
function sunFactor(d: number, h: number): number {
  const utcOffset = d >= DST_START && d < DST_END ? 2 : 1;
  const solarTime = h + 0.5 - utcOffset + LON / 15; // hours, approx. (no equation of time)
  const decl = (23.44 * Math.PI) / 180 * Math.sin((2 * Math.PI * (284 + d + 1)) / 365);
  const ha = ((solarTime - 12) * 15 * Math.PI) / 180;
  const sinEl = Math.sin(LAT) * Math.sin(decl) + Math.cos(LAT) * Math.cos(decl) * Math.cos(ha);
  return sinEl > 0 ? Math.pow(sinEl, 1.3) : 0;
}

let pvShapeCache: Float64Array | null = null;
/** Solar shape normalised to a yearly total of 1. */
export function pvShape(): Float64Array {
  if (pvShapeCache) return pvShapeCache;
  const out = new Float64Array(HOURS);
  const rand = rng(2027);
  const shareTotal = PV_MONTH_SHARE.reduce((a, b) => a + b, 0);
  // Day weather factor: a mix of dull and bright days, as in a Dutch climate.
  const weather = new Float64Array(DAYS);
  for (let d = 0; d < DAYS; d++) {
    const u = rand(), v = rand();
    weather[d] = u < 0.38 ? 0.12 + 0.35 * v : 0.6 + 0.6 * v;
  }
  let dayStart = 0;
  for (let m = 0; m < 12; m++) {
    const nd = MONTH_DAYS.at(m)!;
    let sum = 0;
    for (let d = dayStart; d < dayStart + nd; d++) {
      for (let h = 0; h < 24; h++) {
        const v = sunFactor(d, h) * weather[d];
        out[d * 24 + h] = v;
        sum += v;
      }
    }
    const target = PV_MONTH_SHARE.at(m)! / shareTotal;
    for (let i = dayStart * 24; i < (dayStart + nd) * 24; i++) out[i] = (out[i] / sum) * target;
    dayStart += nd;
  }
  pvShapeCache = out;
  return out;
}

// Hourly household weights (00:00..23:00), weekday.
const BASE = [0.55, 0.5, 0.45, 0.45, 0.45, 0.5, 0.7, 1.0, 1.0, 0.8, 0.75, 0.75, 0.85, 0.75, 0.7, 0.75, 0.9, 1.3, 1.7, 1.6, 1.5, 1.4, 1.1, 0.8];
const DAYTIME = (h: number) => h >= 9 && h <= 16;
// 1 January 2027 is a Friday: day d is a weekend day when (d + 4) % 7 is 5 or 6 (Mon = 0).
const isWeekend = (d: number) => ((d + 4) % 7) >= 5;

function householdShape(kind: Household): Float64Array {
  const out = new Float64Array(HOURS);
  let sum = 0;
  for (let d = 0; d < DAYS; d++) {
    const season = 1 + 0.18 * Math.cos((2 * Math.PI * (d - 15)) / DAYS);
    const weekend = isWeekend(d);
    for (let h = 0; h < 24; h++) {
      let w = BASE.at(h)!;
      if (DAYTIME(h)) {
        if (weekend) w *= 1.3;
        if (kind === 'overdag-thuis') w *= 1.45;
        if (kind === 'zelden-thuis') w *= weekend ? 0.9 : 0.55;
      }
      w *= season;
      out[d * 24 + h] = w;
      sum += w;
    }
  }
  for (let i = 0; i < HOURS; i++) out[i] /= sum;
  return out;
}

function evShape(mode: EvMode): Float64Array {
  const out = new Float64Array(HOURS);
  if (mode === 'geen') return out;
  const hours = mode === 'avond' ? [18, 19, 20, 21, 22] : [10, 11, 12, 13, 14, 15];
  const per = 1 / (DAYS * hours.length);
  for (let d = 0; d < DAYS; d++) for (const h of hours) out[d * 24 + h] = per;
  return out;
}

function heatPumpShape(): Float64Array {
  const out = new Float64Array(HOURS);
  let sum = 0;
  for (let d = 0; d < DAYS; d++) {
    const temp = 10.5 - 7 * Math.cos((2 * Math.PI * (d - 15)) / DAYS);
    const dd = Math.max(0, 15.5 - temp) + 0.6; // + hot water all year
    for (let h = 0; h < 24; h++) {
      const w = dd * (h >= 6 && h <= 9 ? 1.4 : h <= 5 ? 0.9 : 1);
      out[d * 24 + h] = w;
      sum += w;
    }
  }
  for (let i = 0; i < HOURS; i++) out[i] /= sum;
  return out;
}

export interface Profiles { pv: Float64Array; load: Float64Array }

export function buildProfiles(p: ProfileInput): Profiles {
  const pvS = pvShape();
  const hh = householdShape(p.huishouden);
  const ev = evShape(p.evMode);
  const hp = p.warmtepompKwh > 0 ? heatPumpShape() : null;
  const pv = new Float64Array(HOURS);
  const load = new Float64Array(HOURS);
  for (let i = 0; i < HOURS; i++) {
    pv[i] = pvS[i] * p.opwek;
    load[i] = hh[i] * p.verbruik + ev[i] * (p.evMode === 'geen' ? 0 : p.evKwh) + (hp ? hp[i] * p.warmtepompKwh : 0);
  }
  return { pv, load };
}
