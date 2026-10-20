import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import golden from './golden.json';
import regels from '../src/data/regels.json';
import leveranciers from '../src/data/leveranciers.json';
import { buildProfiles, pvShape, HOURS, type ProfileInput } from '../src/engine/profiles';
import { simulate, shiftLoad, eigenverbruik } from '../src/engine/sim';
import {
  runScenario, runBattery, contractByName, kostenZonderSalderen, kostenMetSalderen,
  BATTERIES, CONTRACTS, netto, minimumVergoeding, terugverdientijd, oordeel, DEFAULTS, type Scenario,
} from '../src/engine/costs';

const CENT = 0.02;
const close = (a: number, b: number, tol = CENT) => Math.abs(a - b) <= tol;

describe('golden cases (independent Python reference)', () => {
  for (const g of golden as any[]) {
    it(`${g.case.name} · ${g.contract} · €${g.stroomprijs}`, () => {
      const s: Scenario = {
        ...(g.case as ProfileInput), stroomprijs: g.stroomprijs, terugleverkosten2026: g.terugleverkosten2026,
        contract: contractByName(g.contract)!, verschuifbaar: 0.1,
      };
      const r = runScenario(s);
      const e = g.expected;
      expect(close(r.metSalderen, e.metSalderen), `met ${r.metSalderen} vs ${e.metSalderen}`).toBe(true);
      expect(close(r.zonderSalderen, e.zonderSalderen), `zonder ${r.zonderSalderen} vs ${e.zonderSalderen}`).toBe(true);
      expect(close(r.eigenverbruik, e.eigenverbruik, 0.0001)).toBe(true);
      expect(close(r.basis.teruglevering, e.teruglevering)).toBe(true);
      const opt = (k: string) => r.opties.find((o) => o.key === k);
      expect(close(opt('verschuiven')!.besparing, e.verschuivenBesparing)).toBe(true);
      const over = opt('overstappen');
      if (e.overstappenBesparing > 0.005) expect(close(over!.besparing, e.overstappenBesparing)).toBe(true);
      else expect(over).toBeUndefined();
      for (const k of ['stekker', 'batterij5', 'batterij10'] as const) {
        const o = opt(k)!;
        expect(close(o.besparing, e[k].besparing), `${k} ${o.besparing} vs ${e[k].besparing}`).toBe(true);
        if (e[k].terugverdientijd == null) expect(o.terugverdientijd).toBeNull();
        else expect(close(o.terugverdientijd!, e[k].terugverdientijd, 0.01)).toBe(true);
      }
    });
  }
});

describe('calibration against published anchors', () => {
  const p = buildProfiles(DEFAULTS);
  it('June ≈ 15 kWh/day and December ≈ 2,5 kWh/day for 3.500 kWh (Milieu Centraal)', () => {
    const avg = (from: number, days: number) => p.pv.slice(from * 24, (from + days) * 24).reduce((a, b) => a + b, 0) / days;
    expect(avg(151, 30)).toBeGreaterThan(13.5); expect(avg(151, 30)).toBeLessThan(17);
    expect(avg(334, 31)).toBeGreaterThan(1.8); expect(avg(334, 31)).toBeLessThan(3);
  });
  it('about 30% self-consumption without battery (Milieu Centraal); a 5 kWh battery lifts it to 50–65%', () => {
    const e0 = eigenverbruik(simulate(p, null));
    expect(e0).toBeGreaterThan(0.27); expect(e0).toBeLessThan(0.37);
    const e5 = eigenverbruik(simulate(p, BATTERIES.batterij5));
    expect(e5).toBeGreaterThan(0.5); expect(e5).toBeLessThan(0.65);
  });
  it('a fixed 10 kWh battery at €5.500 does not pay back within its lifetime for the default household (VEH, Consumentenbond)', () => {
    const r = runBattery({ ...DEFAULTS, batterij: BATTERIES.batterij10 });
    expect(r.oordeel).toBe('loont-niet');
  });
});

describe('energy balance and properties', () => {
  const gen = fc.record({
    verbruik: fc.integer({ min: 800, max: 9000 }),
    opwek: fc.integer({ min: 0, max: 12000 }),
    huishouden: fc.constantFrom('standaard', 'overdag-thuis', 'zelden-thuis' as const),
    evKwh: fc.integer({ min: 0, max: 5000 }),
    evMode: fc.constantFrom('geen', 'avond', 'overdag' as const),
    warmtepompKwh: fc.integer({ min: 0, max: 5000 }),
  }) as fc.Arbitrary<ProfileInput>;

  it('profiles sum to the yearly totals', () => {
    fc.assert(fc.property(gen, (pi) => {
      const p = buildProfiles(pi);
      const pv = p.pv.reduce((a, b) => a + b, 0), load = p.load.reduce((a, b) => a + b, 0);
      const ev = pi.evMode === 'geen' ? 0 : pi.evKwh;
      return close(pv, pi.opwek, 0.01) && close(load, pi.verbruik + ev + pi.warmtepompKwh, 0.01);
    }), { numRuns: 40 });
  });

  it('without battery: solar = direct + export, use = direct + import', () => {
    fc.assert(fc.property(gen, (pi) => {
      const r = simulate(buildProfiles(pi), null);
      return close(r.opwek, r.direct + r.teruglevering, 0.01) && close(r.verbruik, r.direct + r.afname, 0.01);
    }), { numRuns: 40 });
  });

  it('with battery: energy is conserved (losses = charged − delivered − stored)', () => {
    fc.assert(fc.property(gen, fc.constantFrom('stekker', 'batterij5', 'batterij10' as const), (pi, k) => {
      const r = simulate(buildProfiles(pi), BATTERIES[k]);
      const solarOk = close(r.opwek, r.direct + r.inBatterij + r.teruglevering, 0.01);
      // Use is covered by direct solar, the battery and the grid; the grid may also supply
      // part of the battery's own standby use, but never more than that.
      const gap = r.afname - (r.verbruik - r.direct - r.uitBatterij);
      const useOk = gap >= -0.01 && gap <= r.standbyKwh + 0.01;
      return solarOk && useOk && r.uitBatterij <= r.inBatterij + 1e-9;
    }), { numRuns: 30 });
  });

  it('a free battery without standby use never makes the bill higher', () => {
    fc.assert(fc.property(gen, (pi) => {
      const p = buildProfiles(pi);
      const c = DEFAULTS.contract;
      const prices = { stroomprijs: 0.31, terugleverkosten2026: 0.14, contract: c };
      const base = kostenZonderSalderen(simulate(p, null), prices);
      const bat = kostenZonderSalderen(simulate(p, { ...BATTERIES.batterij5, standby: 0 }), prices);
      return bat <= base + 0.01;
    }), { numRuns: 30 });
  });

  it('shifting moves use but never changes the yearly total', () => {
    fc.assert(fc.property(gen, fc.double({ min: 0, max: 0.3, noNaN: true }), (pi, share) => {
      const p = buildProfiles(pi);
      const { load } = shiftLoad(p, share);
      return close(load.reduce((a, b) => a + b, 0), p.load.reduce((a, b) => a + b, 0), 0.01) && load.every((v) => v >= -1e-9);
    }), { numRuns: 30 });
  });

  it('no solar panels: saldering makes no difference', () => {
    const r = runScenario({ ...DEFAULTS, opwek: 0 });
    expect(close(r.metSalderen, r.zonderSalderen)).toBe(true);
  });
});

describe('rules and data', () => {
  it('every rule has a status and an https source', () => {
    for (const [k, v] of Object.entries(regels.rules)) {
      expect(['definitief', 'voorlopig', 'voorstel'], k).toContain((v as any).status);
      expect((v as any).source, k).toMatch(/^https:\/\//);
    }
  });
  it('every supplier row has a check date and source, and a non-negative net value', () => {
    for (const l of leveranciers.fixed) {
      expect(l.checked_at).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(l.source).toMatch(/^https:\/\//);
      expect(l.vergoeding - l.kosten).toBeGreaterThanOrEqual(0);
    }
  });
  it('contracts are sorted on net value only', () => {
    for (let i = 1; i < CONTRACTS.length; i++) expect(netto(CONTRACTS[i - 1])).toBeGreaterThanOrEqual(netto(CONTRACTS[i]));
  });
  it('the statutory floor is 50% of the kale price, excl. VAT and energy tax', () => {
    // €0,31 all-in → 0,31/1,21 − 0,08802 = 0,16818 kale → 50% = 0,08409
    expect(close(minimumVergoeding(0.31), 0.08409, 0.0001)).toBe(true);
  });
  it('payback and verdict', () => {
    expect(terugverdientijd(100, 500, 0)).toBe(5);
    expect(terugverdientijd(0, 500, 0)).toBeNull();
    expect(oordeel(5, 10)).toBe('loont');
    expect(oordeel(9, 10)).toBe('twijfel');
    expect(oordeel(12, 10)).toBe('loont-niet');
    expect(pvShape().length).toBe(HOURS);
  });
});
