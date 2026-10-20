<script lang="ts">
  import type { Option } from '../engine/costs';
  import Affiliate from './Affiliate.svelte';

  let { opties }: { opties: Option[] } = $props();

  const niets = $derived(opties.find((o) => o.key === 'niets'));
  const rest = $derived.by(() => {
    const free = opties.filter((o) => o.oordeel === 'gratis').sort((a, b) => b.besparing - a.besparing);
    const paid = opties.filter((o) => o.investering > 0).sort((a, b) => (a.terugverdientijd ?? 999) - (b.terugverdientijd ?? 999));
    return [...free, ...paid];
  });
  const max = $derived(Math.max(1, ...rest.map((o) => o.besparing)));
  const anyBatteryPays = $derived(rest.some((o) => o.investering > 0 && o.oordeel === 'loont'));
  const canSwitch = $derived(rest.some((o) => o.key === 'overstappen'));

  const eur = (v: number) => Math.round(v).toLocaleString('nl-NL', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
  const yrs = (v: number) => v.toLocaleString('nl-NL', { maximumFractionDigits: 1 });
  const detail = (o: Option) => {
    if (o.investering <= 0) return `. ${o.toelichting}`;
    const tvt = o.terugverdientijd != null ? `terugverdiend na ${yrs(o.terugverdientijd)} jaar` : 'verdient zich niet terug';
    return `. Kost ${eur(o.investering)}, ${tvt}, bij een levensduur van ongeveer ${o.levensduur} jaar.`;
  };
  const word: Record<Option['oordeel'], string> = { loont: 'Loont', twijfel: 'Twijfelachtig', 'loont-niet': 'Loont niet', gratis: 'Gratis', basis: '' };
</script>

<section class="options" aria-labelledby="opt-title">
  <h3 id="opt-title">Wat kun je doen?</h3>
  <p class="intro">Gerangschikt: eerst wat niets kost, dan batterijen op terugverdientijd. {#if niets}{niets.toelichting}{/if}</p>
  <ol>
    {#each rest as o (o.key)}
      <li class={o.oordeel}>
        <div class="top">
          <span class="name">{o.label}</span>
          <span class="verdict">{word[o.oordeel]}</span>
        </div>
        <div class="bar" aria-hidden="true"><span style:width={`${Math.max(0, (o.besparing / max) * 100)}%`}></span></div>
        <p class="detail"><strong>{o.besparing > 0 ? `${eur(o.besparing)} per jaar` : 'Geen besparing'}</strong>{detail(o)}</p>
        {#if o.investering > 0}<p class="sub">{o.toelichting}</p>{/if}
      </li>
    {/each}
  </ol>
  <p class="bench">Ter vergelijking: Vereniging Eigen Huis en CE Delft maten bij een gemiddeld huishouden 10 tot 22 jaar terugverdientijd voor een thuisbatterij; de Consumentenbond rekent met ongeveer 15 jaar, gelijk aan de levensduur. Batterijprijzen zijn voorbeelden uit oktober 2026. <a href="/thuisbatterij-terugverdientijd">Reken je eigen batterij door</a>.</p>
  {#if canSwitch}<Affiliate kind="overstappen" context="Een andere leverancier kan meer opleveren voor je teruglevering. Vergelijk ook de leveringsprijs." />{/if}
  {#if anyBatteryPays}<Affiliate kind="offertes" context="Volgens deze berekening kan een batterij bij jou lonen. Vraag meerdere offertes en vergelijk de prijs per kWh opslag." />{/if}
</section>

<style>
  .options { background: var(--paper); border-radius: var(--r); padding: 18px 18px 14px; }
  h3 { margin: 0 0 4px; }
  .intro { color: var(--ink-soft); font-size: var(--s-1); }
  ol { list-style: none; margin: 0; padding: 0; display: grid; gap: 14px; }
  li { border-left: 4px solid var(--lost); padding: 2px 0 2px 12px; }
  li.gratis, li.loont { border-left-color: var(--kept); }
  li.twijfel { border-left-color: var(--warn); }
  .top { display: flex; justify-content: space-between; gap: 12px; align-items: baseline; }
  .name { font-weight: 600; }
  .verdict { font-size: var(--s-1); font-weight: 700; white-space: nowrap; color: var(--ink-soft); }
  li.gratis .verdict, li.loont .verdict { color: var(--kept); }
  li.twijfel .verdict { color: var(--warn); }
  .bar { height: 8px; background: var(--lost-soft); border-radius: 4px; margin: 6px 0; overflow: hidden; }
  .bar span { display: block; height: 100%; background: var(--kept); border-radius: 4px; }
  li.twijfel .bar span { background: var(--warn); }
  li.loont-niet .bar span { background: var(--lost); }
  .detail { margin: 0; font-size: var(--s-1); }
  .sub { margin: 2px 0 0; font-size: var(--s-1); color: var(--ink-soft); }
  .bench { margin: 16px 0 0; font-size: var(--s-1); color: var(--ink-soft); }
</style>
