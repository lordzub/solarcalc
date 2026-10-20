<script lang="ts">
  import { onMount } from 'svelte';
  import { runScenario, CONTRACTS, contractByName, netto, R, type Contract, type Option } from '../engine/costs';
  import { KWH_PER_PANEEL } from '../lib/examples';
  import { readHash, writeHash, copyLink } from './hashState';
  import DayCurve from './DayCurve.svelte';
  import Options from './Options.svelte';

  const defaults = {
    verbruik: 2900, panelen: 10, opwek: 0, leverancier: 'Vattenfall', eigVerg: 9, eigKost: 5,
    huishouden: 'standaard', ev: 0, laden: 'avond', warmtepomp: 0,
    prijs: R.stroomprijs2027.value, tlk: R.terugleverkosten2026.value, verschuif: 10,
  };
  let s = $state({ ...defaults });
  let ready = $state(false);
  let seizoen = $state<'zomer' | 'winter' | 'jaar'>('zomer');
  let copied = $state(false);
  let resultEl: HTMLElement | undefined = $state();
  let resultVisible = $state(true);
  let touched = $state(false);
  onMount(() => {
    s = readHash(defaults); ready = true;
    // Sticky summary on phones while the result is out of view.
    const io = new IntersectionObserver(([e]) => (resultVisible = e.isIntersecting), { threshold: 0.05 });
    if (resultEl) io.observe(resultEl);
    return () => io.disconnect();
  });
  $effect(() => { if (ready) writeHash({ ...s }); });

  const opwek = $derived(s.opwek > 0 ? s.opwek : Math.max(0, s.panelen) * KWH_PER_PANEEL);
  const contract = $derived<Contract>(
    s.leverancier === 'eigen'
      ? { naam: 'Eigen tarief', vergoeding: (s.eigVerg || 0) / 100, kosten: (s.eigKost || 0) / 100 }
      : contractByName(s.leverancier) ?? CONTRACTS[0],
  );
  const res = $derived(runScenario({
    verbruik: Math.max(0, s.verbruik || 0), opwek, huishouden: s.huishouden as any,
    evKwh: Math.max(0, s.ev || 0), evMode: (s.ev || 0) > 0 ? (s.laden as any) : 'geen',
    warmtepompKwh: Math.max(0, s.warmtepomp || 0),
    stroomprijs: s.prijs || 0, terugleverkosten2026: s.tlk || 0, contract, verschuifbaar: (s.verschuif || 0) / 100,
  }));

  const eur = (v: number) => Math.round(v).toLocaleString('nl-NL', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
  const kwh = (v: number) => Math.round(v).toLocaleString('nl-NL');
  const pct = (v: number) => `${Math.round(v * 100)}%`;
  const ct = (v: number) => (v * 100).toLocaleString('nl-NL', { maximumFractionDigits: 2 });
  async function share() { copied = await copyLink(); setTimeout(() => (copied = false), 2000); }
  const presets = [['Appartement', 1800], ['Tussenwoning', 2900], ['Groot huishouden', 4000]] as const;
</script>

{#if ready && touched && !resultVisible}
  <a class="sticky" href="#uitkomst">{res.verschil > 0.5 ? `2027: ${eur(res.verschil)} per jaar duurder` : res.verschil < -0.5 ? `2027: ${eur(-res.verschil)} per jaar goedkoper` : 'Weinig verschil in 2027'}<span>Bekijk uitkomst</span></a>
{/if}
<div class="calc">
  <form class="inputs" onsubmit={(e) => e.preventDefault()} oninput={() => (touched = true)} onclick={(e) => { if ((e.target as HTMLElement).tagName === 'BUTTON') touched = true; }}>
    <div class="field">
      <label for="verbruik">Hoeveel stroom gebruik je per jaar?</label>
      <div class="input"><input id="verbruik" type="number" inputmode="numeric" min="0" step="100" bind:value={s.verbruik} /><span>kWh</span></div>
      <div class="chips" role="group" aria-label="Snel kiezen">
        {#each presets as [n, v]}<button type="button" class:on={s.verbruik === v} onclick={() => (s.verbruik = v)}>{n} ({v.toLocaleString('nl-NL')})</button>{/each}
      </div>
      <span class="hint">Staat op je jaarafrekening. Zonder auto en warmtepomp; die kun je hieronder toevoegen.</span>
    </div>

    <div class="field">
      <label for="panelen">Hoeveel zonnepanelen heb je?</label>
      <div class="input"><input id="panelen" type="number" inputmode="numeric" min="0" step="1" bind:value={s.panelen} oninput={() => (s.opwek = 0)} /><span>panelen</span></div>
      <span class="hint">We rekenen met {KWH_PER_PANEEL} kWh per paneel per jaar. Weet je je jaaropwek? <label class="inline" for="opwek">Vul die in:</label></span>
      <div class="input small"><input id="opwek" type="number" inputmode="numeric" min="0" step="100" placeholder={`${opwek} (geschat)`} value={s.opwek || ''} oninput={(e) => (s.opwek = Number(e.currentTarget.value) || 0)} /><span>kWh per jaar</span></div>
    </div>

    <div class="field">
      <label for="leverancier">Bij welke leverancier zit je in 2027?</label>
      <div class="input">
        <select id="leverancier" bind:value={s.leverancier}>
          {#each CONTRACTS as c}<option value={c.naam}>{c.naam} (netto {ct(netto(c))} ct)</option>{/each}
          <option value="eigen">Eigen tarief invullen</option>
        </select>
      </div>
      {#if s.leverancier === 'eigen'}
        <div class="two">
          <div class="field"><label for="ev1">Terugleververgoeding</label><div class="input"><input id="ev1" type="number" step="0.1" min="0" bind:value={s.eigVerg} /><span>ct/kWh</span></div></div>
          <div class="field"><label for="ev2">Terugleverkosten</label><div class="input"><input id="ev2" type="number" step="0.1" min="0" bind:value={s.eigKost} /><span>ct/kWh</span></div></div>
        </div>
      {/if}
      <span class="hint">Tarieven 2027 voor een 1-jarig vast contract, incl. btw. <a href="/terugleverkosten-per-leverancier">Alle leveranciers</a>.</span>
    </div>

    <details class="more">
      <summary>Verfijn je berekening</summary>
      <div class="field">
        <span class="legend" id="hh-l">Wanneer ben je thuis?</span>
        <div class="seg" role="group" aria-labelledby="hh-l">
          <button type="button" aria-pressed={s.huishouden === 'zelden-thuis'} onclick={() => (s.huishouden = 'zelden-thuis')}>Overdag zelden</button>
          <button type="button" aria-pressed={s.huishouden === 'standaard'} onclick={() => (s.huishouden = 'standaard')}>Gemiddeld</button>
          <button type="button" aria-pressed={s.huishouden === 'overdag-thuis'} onclick={() => (s.huishouden = 'overdag-thuis')}>Vaak overdag</button>
        </div>
      </div>
      <div class="two">
        <div class="field"><label for="ev">Elektrische auto, laden per jaar</label><div class="input"><input id="ev" type="number" min="0" step="250" bind:value={s.ev} /><span>kWh</span></div></div>
        <div class="field"><label for="laden">Wanneer laad je?</label><div class="input"><select id="laden" bind:value={s.laden}><option value="avond">'s Avonds</option><option value="overdag">Overdag</option></select></div></div>
      </div>
      <div class="field"><label for="wp">Warmtepomp, verbruik per jaar</label><div class="input"><input id="wp" type="number" min="0" step="250" bind:value={s.warmtepomp} /><span>kWh</span></div></div>
      <div class="field">
        <label for="prijs">Je stroomprijs per kWh, alles inbegrepen</label>
        <div class="input"><span>€</span><input id="prijs" type="number" min="0" step="0.01" bind:value={s.prijs} /></div>
        <span class="hint">{R.stroomprijs2027.note}</span>
      </div>
      <div class="field">
        <label for="tlk">Terugleverkosten die je nu (2026) betaalt</label>
        <div class="input"><span>€</span><input id="tlk" type="number" min="0" step="0.01" bind:value={s.tlk} /><span>per kWh</span></div>
        <span class="hint">{R.terugleverkosten2026.note}</span>
      </div>
      <div class="field">
        <label for="shift">Hoeveel van je dagverbruik kun je naar zonuren verschuiven? <strong>{s.verschuif}%</strong></label>
        <input id="shift" type="range" min="0" max="30" step="5" bind:value={s.verschuif} />
        <span class="hint">Wasmachine, vaatwasser, droger of auto overdag aanzetten. 10% is voor de meeste huishoudens haalbaar.</span>
      </div>
    </details>
  </form>

  <section class="result" id="uitkomst" aria-live="polite" aria-label="Uitkomst" bind:this={resultEl}>
    <div class="headline">
      {#if res.verschil > 0.5}
        <p class="big">Vanaf 2027 <strong>{eur(res.verschil)}</strong> per jaar duurder</p>
        <p class="sub">Dat is ongeveer {eur(res.verschil / 12)} per maand. Met salderen betaal je {eur(res.metSalderen)} voor stroom, zonder salderen {eur(res.zonderSalderen)}.</p>
      {:else if res.verschil < -0.5}
        <p class="big">Vanaf 2027 <strong>{eur(-res.verschil)}</strong> per jaar goedkoper</p>
        <p class="sub">Je levert veel terug. In 2026 betaal je daarover terugleverkosten van {s.tlk.toLocaleString('nl-NL', { style: 'currency', currency: 'EUR' })} per kWh; vanaf 2027 krijg je netto nog iets terug. Met salderen {eur(res.metSalderen)}, zonder {eur(res.zonderSalderen)}. Klopt je terugleverkosten-bedrag voor 2026? Pas het aan onder "Verfijn".</p>
      {:else}
        <p class="big">Je merkt weinig van het einde van salderen</p>
        <p class="sub">Met salderen {eur(res.metSalderen)}, zonder {eur(res.zonderSalderen)} per jaar voor stroom.</p>
      {/if}
      <dl class="facts">
        <div><dt>Zelf gebruikt</dt><dd>{pct(res.eigenverbruik)} van je opwek</dd></div>
        <div><dt>Teruggeleverd</dt><dd>{kwh(res.basis.teruglevering)} kWh</dd></div>
        <div><dt>Netto opbrengst teruglevering</dt><dd>{ct(netto(contract))} ct per kWh</dd></div>
      </dl>
      {#if s.leverancier === 'eigen' && contract.vergoeding < res.minimumVergoeding - 0.0005}
        <p class="warn">Je vergoeding ligt onder het wettelijke minimum van {ct(res.minimumVergoeding)} ct (50% van de kale leveringsprijs). Vraag je leverancier waarom.</p>
      {/if}
    </div>

    <div class="season seg" role="group" aria-label="Seizoen">
      <button type="button" aria-pressed={seizoen === 'zomer'} onclick={() => (seizoen = 'zomer')}>Zomerdag</button>
      <button type="button" aria-pressed={seizoen === 'winter'} onclick={() => (seizoen = 'winter')}>Winterdag</button>
      <button type="button" aria-pressed={seizoen === 'jaar'} onclick={() => (seizoen = 'jaar')}>Gemiddeld</button>
    </div>
    <DayCurve curve={res.basis.dag[seizoen]} label={seizoen === 'zomer' ? 'Jouw gemiddelde zomerdag (mei–augustus)' : seizoen === 'winter' ? 'Jouw gemiddelde winterdag (november–januari)' : 'Jouw gemiddelde dag over het jaar'} prijs={s.prijs} netto={netto(contract)} compact />

    <Options opties={res.opties} />

    <p class="tools"><button class="btn" type="button" onclick={share}>{copied ? 'Link gekopieerd' : 'Kopieer link naar deze berekening'}</button></p>
    <p class="note">Een schatting met een modelprofiel per uur, geen advies. Vaste kosten, netbeheer en de belastingvermindering zijn in beide situaties gelijk en tellen niet mee. <a href="/zo-rekenen-we">Zo rekenen we</a>.</p>
  </section>
</div>

<style>
  .calc { display: grid; gap: 24px; margin-top: 24px; }
  @media (min-width: 960px) { .calc { grid-template-columns: minmax(0, 0.85fr) minmax(0, 1.15fr); align-items: start; } }
  .inputs { display: grid; gap: 20px; background: var(--paper); border-radius: var(--r); padding: 20px; }
  .two { display: grid; gap: 12px; }
  @media (min-width: 520px) { .two { grid-template-columns: 1fr 1fr; align-items: end; } }
  .chips { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 2px; }
  .chips button { font: inherit; font-size: var(--s-1); border: 1.5px solid var(--line); background: transparent; color: var(--ink); border-radius: 999px; padding: 3px 10px; cursor: pointer; }
  .chips button.on { border-color: var(--ink); background: var(--ink); color: var(--paper); }
  .small { max-width: 240px; }
  .inline { font-weight: 400; }
  .more { border-top: 1px solid var(--line); padding-top: 14px; }
  .more summary { cursor: pointer; font-weight: 600; }
  .more[open] { display: grid; gap: 18px; }
  .result { display: grid; gap: 16px; }
  /* The "night" panel keeps the same colours in light and dark mode. */
  .headline { background: #13233a; color: #eaf0f5; border-radius: var(--r); padding: 20px 22px; }
  .headline :global(a) { color: #eaf0f5; }
  .big { font-family: var(--display); font-size: clamp(1.6rem, 1.2rem + 1.6vw, 2.3rem); line-height: 1.1; margin: 0 0 8px; letter-spacing: -0.02em; }
  .big strong { color: var(--sun); font-weight: 800; }
  .sub { margin: 0; opacity: 0.9; }
  .facts { display: flex; flex-wrap: wrap; gap: 10px 28px; margin: 16px 0 0; }
  .facts div { display: grid; }
  .facts dt { font-size: var(--s-1); opacity: 0.8; }
  .facts dd { margin: 0; font-weight: 600; }
  .warn { margin: 12px 0 0; color: #f0a12a; }
  .big strong { color: #f0a12a; }
  .season { justify-self: start; }
  .tools { margin: 0; }
  .sticky { position: fixed; left: 0; right: 0; bottom: 0; z-index: 20; display: flex; justify-content: space-between; align-items: center; gap: 12px; padding: 12px var(--gutter); background: #13233a; color: #eaf0f5; font-weight: 700; text-decoration: none; box-shadow: 0 -2px 12px rgba(19, 35, 58, 0.25); }
  .sticky span { white-space: nowrap; font-weight: 400; text-decoration: underline; text-decoration-color: #f0a12a; }
  @media (min-width: 960px) { .sticky { display: none; } }
</style>
