import { HOURS, DAYS, monthOfDay, type Profiles } from './profiles';

export interface Battery {
  capaciteit: number;   // usable kWh
  vermogen: number;     // kW (charge and discharge limit)
  rendement: number;    // round-trip efficiency, e.g. 0.88
  standby: number;      // W, continuous own use
}

export interface SimResult {
  opwek: number;
  verbruik: number;
  direct: number;        // solar used directly (incl. shifted use)
  uitBatterij: number;   // delivered to the house from the battery
  inBatterij: number;    // taken from solar surplus into the battery
  afname: number;        // from the grid
  teruglevering: number; // to the grid
  standbyKwh: number;
  verschoven: number;    // kWh of use moved into solar hours
  /** Average hour-by-hour day per season, for the day chart. */
  dag: { zomer: DayCurve; winter: DayCurve; jaar: DayCurve };
}

export interface DayCurve { opwek: number[]; verbruik: number[]; eigen: number[] }

/**
 * Move up to `share` of each day's use from hours without surplus into hours with
 * solar surplus (washing machine, dishwasher, EV). Use is only moved where surplus exists.
 */
export function shiftLoad(p: Profiles, share: number): { load: Float64Array; moved: number } {
  const load = Float64Array.from(p.load);
  if (share <= 0) return { load, moved: 0 };
  let moved = 0;
  for (let d = 0; d < DAYS; d++) {
    const o = d * 24;
    let dayUse = 0, surplus = 0, donor = 0;
    for (let h = 0; h < 24; h++) {
      dayUse += load[o + h];
      const s = p.pv[o + h] - load[o + h];
      if (s > 0) surplus += s; else donor += load[o + h];
    }
    const want = Math.min(share * dayUse, surplus, donor);
    if (want <= 0) continue;
    for (let h = 0; h < 24; h++) {
      const i = o + h;
      const s = p.pv[i] - p.load[i];
      if (s > 0) load[i] += want * (s / surplus);
      else load[i] -= want * (p.load[i] / donor);
    }
    moved += want;
  }
  return { load, moved };
}

const zeros = () => Array.from({ length: 24 }, () => 0);

export function simulate(p: Profiles, battery: Battery | null, shiftShare = 0): SimResult {
  const { load, moved } = shiftLoad(p, shiftShare);
  const eta = battery ? Math.sqrt(battery.rendement) : 1;
  const standbyH = battery ? battery.standby / 1000 : 0;
  let soc = 0;
  let opwek = 0, verbruik = 0, direct = 0, uit = 0, inB = 0, afname = 0, terug = 0, standbyKwh = 0;
  const curves = { zomer: { opwek: zeros(), verbruik: zeros(), eigen: zeros(), n: 0 }, winter: { opwek: zeros(), verbruik: zeros(), eigen: zeros(), n: 0 }, jaar: { opwek: zeros(), verbruik: zeros(), eigen: zeros(), n: 0 } };

  for (let i = 0; i < HOURS; i++) {
    const pv = p.pv[i], use = load[i];
    opwek += pv; verbruik += use;
    const d = Math.min(pv, use);
    direct += d;
    let surplus = pv - d, deficit = use - d;
    let fromBat = 0;
    if (battery) {
      if (surplus > 0) {
        const charge = Math.min(surplus, battery.vermogen, (battery.capaciteit - soc) / eta);
        if (charge > 0) { soc += charge * eta; surplus -= charge; inB += charge; }
      }
      if (deficit > 0) {
        fromBat = Math.min(deficit, battery.vermogen, soc * eta);
        if (fromBat > 0) { soc -= fromBat / eta; deficit -= fromBat; uit += fromBat; }
      }
      // Standby use: from the battery when it has charge, else from the grid.
      standbyKwh += standbyH;
      if (soc >= standbyH) soc -= standbyH; else { deficit += standbyH - soc; soc = 0; }
    }
    afname += deficit;
    terug += surplus;

    const h = i % 24, m = monthOfDay(Math.floor(i / 24));
    const eigen = d + fromBat;
    for (const c of [curves.jaar, m >= 4 && m <= 7 ? curves.zomer : m <= 0 || m >= 10 ? curves.winter : null]) {
      if (!c) continue;
      c.opwek[h] += pv; c.verbruik[h] += use; c.eigen[h] += eigen;
      if (h === 0) c.n++;
    }
  }
  const avg = (c: typeof curves.jaar): DayCurve => ({
    opwek: c.opwek.map((v) => v / c.n), verbruik: c.verbruik.map((v) => v / c.n), eigen: c.eigen.map((v) => v / c.n),
  });
  return {
    opwek, verbruik, direct, uitBatterij: uit, inBatterij: inB, afname, teruglevering: terug, standbyKwh, verschoven: moved,
    dag: { zomer: avg(curves.zomer), winter: avg(curves.winter), jaar: avg(curves.jaar) },
  };
}

/** Share of the solar yield used in the house (directly or via the battery). */
export const eigenverbruik = (r: SimResult) => (r.opwek > 0 ? (r.direct + r.uitBatterij) / r.opwek : 0);
