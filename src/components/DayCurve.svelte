<script lang="ts">
  import type { DayCurve } from '../engine/sim';

  let {
    curve,
    label = 'Gemiddelde dag',
    prijs = 0.31,
    netto = 0.04,
    compact = false,
  }: { curve: DayCurve; label?: string; prijs?: number; netto?: number; compact?: boolean } = $props();

  const W = 640, H = compact ? 220 : 280, L = 44, R = 12, T = 16, B = 34;
  const iw = W - L - R, ih = H - T - B;
  const ymax = $derived(Math.max(0.2, ...curve.opwek, ...curve.verbruik) * 1.12);
  const x = (h: number) => L + (h / 24) * iw;
  const y = (v: number) => T + ih - (v / ymax) * ih;
  // Each value covers its hour: draw as a smooth path through hour midpoints, flat at the edges.
  const path = (vals: number[]) => {
    const pts = vals.map((v, h) => [x(h + 0.5), y(v)] as const);
    let d = `M${x(0)} ${y(vals[0])} L${pts[0][0]} ${pts[0][1]}`;
    for (let i = 1; i < pts.length; i++) {
      const [x0, y0] = pts[i - 1], [x1, y1] = pts[i];
      const cx = (x0 + x1) / 2;
      d += ` C${cx} ${y0} ${cx} ${y1} ${x1} ${y1}`;
    }
    return d + ` L${x(24)} ${y(vals[23])}`;
  };
  const area = (vals: number[]) => `${path(vals)} L${x(24)} ${y(0)} L${x(0)} ${y(0)} Z`;
  const ticks = $derived.by(() => {
    const step = ymax > 2 ? 0.5 : ymax > 1 ? 0.25 : 0.1;
    const out: number[] = [];
    for (let v = 0; v <= ymax; v += step) out.push(Number(v.toFixed(2)));
    return out;
  });
  const sum = (a: number[]) => a.reduce((s, v) => s + v, 0);
  const totals = $derived({ opwek: sum(curve.opwek), verbruik: sum(curve.verbruik), eigen: sum(curve.eigen) });
  const kwh = (v: number) => v.toLocaleString('nl-NL', { maximumFractionDigits: 1 });
  const eur = (v: number) => v.toLocaleString('nl-NL', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2 });
</script>

<figure class="curve" class:compact>
  <figcaption>
    <strong>{label}</strong>
    <span>{kwh(totals.opwek)} kWh zonnestroom, {kwh(totals.verbruik)} kWh verbruik, waarvan {kwh(totals.eigen)} kWh uit je eigen panelen</span>
  </figcaption>
  <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${label}: zonnestroom piekt rond het middaguur, het verbruik in de avond. Per dag ${kwh(totals.opwek)} kWh opwek, ${kwh(totals.eigen)} kWh zelf gebruikt.`}>
    {#each ticks as t}
      <line x1={L} x2={W - R} y1={y(t)} y2={y(t)} class="grid" />
      <text x={L - 8} y={y(t) + 4} text-anchor="end" class="tick">{t.toLocaleString('nl-NL')}</text>
    {/each}
    {#each [0, 6, 12, 18, 24] as h}
      <text x={x(h)} y={H - 10} text-anchor={h === 0 ? 'start' : h === 24 ? 'end' : 'middle'} class="tick">{h}:00</text>
    {/each}
    <path d={area(curve.opwek)} class="sun" />
    <path d={area(curve.eigen)} class="kept" />
    <path d={path(curve.opwek)} class="sun-line" />
    <path d={path(curve.verbruik)} class="use" />
    <text x={L - 36} y={T + 4} class="tick">kWh</text>
  </svg>
  <ul class="legend">
    <li><i class="sw kept"></i>Zelf gebruikt: bespaart {eur(prijs)} per kWh</li>
    <li><i class="sw sun"></i>Teruggeleverd: levert netto {eur(netto)} per kWh op</li>
    <li><i class="sw use"></i>Je verbruik; wat erboven uitsteekt komt uit het net</li>
  </ul>
</figure>

<style>
  .curve { margin: 0; background: var(--paper); border-radius: var(--r); padding: 16px 16px 12px; }
  figcaption { display: grid; gap: 2px; margin-bottom: 6px; }
  figcaption strong { font-family: var(--display); font-size: var(--s1); }
  figcaption span { font-size: var(--s-1); color: var(--ink-soft); }
  svg { width: 100%; height: auto; display: block; }
  .grid { stroke: var(--line); stroke-width: 1; }
  .tick { fill: var(--ink-soft); font-size: 11px; font-family: var(--body); }
  .sun { fill: var(--sun-soft); }
  .sun-line { fill: none; stroke: var(--sun); stroke-width: 2; }
  .kept { fill: var(--kept); opacity: 0.85; }
  .use { fill: none; stroke: var(--ink); stroke-width: 2.5; stroke-linejoin: round; }
  .legend { list-style: none; margin: 8px 0 0; padding: 0; display: flex; flex-wrap: wrap; gap: 4px 18px; font-size: var(--s-1); }
  .legend li { display: flex; align-items: center; gap: 7px; }
  .sw { display: inline-block; width: 14px; height: 10px; border-radius: 2px; }
  .sw.kept { background: var(--kept); }
  .sw.sun { background: var(--sun-soft); border: 2px solid var(--sun); }
  .sw.use { height: 0; border-top: 3px solid var(--ink); width: 16px; border-radius: 0; }
</style>
