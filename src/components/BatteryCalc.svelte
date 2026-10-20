<script lang="ts">
  import { onMount } from 'svelte';
  import { runBattery, CONTRACTS, contractByName, netto, BATTERIES, R, type BatteryOffer } from '../engine/costs';
  import { buildProfiles } from '../engine/profiles';
  import { KWH_PER_PANEEL } from '../lib/examples';
  import { readHash, writeHash, copyLink } from './hashState';
  import DayCurve from './DayCurve.svelte';
  import Affiliate from './Affiliate.svelte';

  const b5 = BATTERIES.batterij5;
  const defaults = {
    verbruik: 2900, panelen: 10, leverancier: 'Vattenfall', huishouden: 'standaard', prijs: R.stroomprijs2027.value, verschuif: 0,
    kwh: b5.capaciteit, kw: b5.vermogen, bprijs: b5.prijs, rendement: 88, standby: b5.standby, levensduur: b5.levensduur,
  };
  let s = $state({ ...defaults });
  let ready = $state(false);
  let copied = $state(false);
  onMount(() => { s = readHash(defaults); ready = true; });
  $effect(() => { if (ready) writeHash({ ...s }); });

  const presets: [string, BatteryOffer][] = [['Stekker 2,7 kWh', BATTERIES.stekker], ['5 kWh', BATTERIES.batterij5], ['Vast 10 kWh', BATTERIES.batterij10]];
  const pick = (b: BatteryOffer) => { s.kwh = b.capaciteit; s.kw = b.vermogen; s.bprijs = b.prijs; s.rendement = Math.round(b.rendement * 100); s.standby = b.standby; s.levensduur = b.levensduur; };

  const base = $derived({
    verbruik: Math.max(0, s.verbruik || 0), opwek: Math.max(0, s.panelen || 0) * KWH_PER_PANEEL, huishouden: s.huishouden as any,
    evKwh: 0, evMode: 'geen' as const, warmtepompKwh: 0,
  });
  const profiles = $derived(buildProfiles(base));
  const contract = $derived(contractByName(s.leverancier) ?? CONTRACTS[0]);
  const battery = $derived<BatteryOffer>({
    label: 'Jouw batterij', capaciteit: Math.max(0, s.kwh || 0), vermogen: Math.max(0.1, s.kw || 0.1), rendement: Math.min(1, Math.max(0.5, (s.rendement || 88) / 100)),
    standby: Math.max(0, s.standby || 0), prijs: Math.max(0, s.bprijs || 0),
    levensduur: Math.max(1, s.levensduur || 10), degradatie: s.levensduur > 12 ? 0.015 : 0.02,
  });
  const run = (prijs: number) => runBattery({ ...base, stroomprijs: prijs, terugleverkosten2026: R.terugleverkosten2026.value, contract, verschuifbaar: (s.verschuif || 0) / 100, batterij: battery }, profiles);
  const res = $derived(run(s.prijs || 0));
  const gevoelig = $derived([0.29, 0.34, 0.38].map((p) => ({ p, r: run(p) })));

  const eur = (v: number) => Math.round(v).toLocaleString('nl-NL', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
  const yrs = (v: number | null) => (v == null ? 'niet' : `${v.toLocaleString('nl-NL', { maximumFractionDigits: 1 })} jaar`);
  const pct = (v: number) => `${Math.round(v * 100)}%`;
  const word = { loont: 'Loont', twijfel: 'Twijfelachtig', 'loont-niet': 'Loont niet', gratis: '', basis: '' } as const;
  async function share() { copied = await copyLink(); setTimeout(() => (copied = false), 2000); }
</script>

<div class="calc">
  <form class="inputs" onsubmit={(e) => e.preventDefault()}>
    <fieldset>
      <legend>Je huis</legend>
      <div class="two">
        <div class="field"><label for="b-verbruik">Stroomverbruik per jaar</label><div class="input"><input id="b-verbruik" type="number" min="0" step="100" bind:value={s.verbruik} /><span>kWh</span></div></div>
        <div class="field"><label for="b-panelen">Zonnepanelen</label><div class="input"><input id="b-panelen" type="number" min="0" step="1" bind:value={s.panelen} /><span>panelen</span></div></div>
      </div>
      <div class="field">
        <span class="legend" id="b-hh">Wanneer ben je thuis?</span>
        <div class="seg" role="group" aria-labelledby="b-hh">
          <button type="button" aria-pressed={s.huishouden === 'zelden-thuis'} onclick={() => (s.huishouden = 'zelden-thuis')}>Overdag zelden</button>
          <button type="button" aria-pressed={s.huishouden === 'standaard'} onclick={() => (s.huishouden = 'standaard')}>Gemiddeld</button>
          <button type="button" aria-pressed={s.huishouden === 'overdag-thuis'} onclick={() => (s.huishouden = 'overdag-thuis')}>Vaak overdag</button>
        </div>
      </div>
      <div class="two">
        <div class="field"><label for="b-lev">Leverancier 2027</label><div class="input"><select id="b-lev" bind:value={s.leverancier}>{#each CONTRACTS as c}<option value={c.naam}>{c.naam}</option>{/each}</select></div></div>
        <div class="field"><label for="b-prijs">Stroomprijs per kWh</label><div class="input"><span>€</span><input id="b-prijs" type="number" min="0" step="0.01" bind:value={s.prijs} /></div></div>
      </div>
    </fieldset>

    <fieldset>
      <legend>De batterij</legend>
      <div class="chips" role="group" aria-label="Voorbeeldbatterijen">
        {#each presets as [n, b]}<button type="button" class:on={s.kwh === b.capaciteit && s.bprijs === b.prijs} onclick={() => pick(b)}>{n}</button>{/each}
      </div>
      <div class="two">
        <div class="field"><label for="b-kwh">Opslag (bruikbaar)</label><div class="input"><input id="b-kwh" type="number" min="0" step="0.1" bind:value={s.kwh} /><span>kWh</span></div></div>
        <div class="field"><label for="b-kw">Vermogen</label><div class="input"><input id="b-kw" type="number" min="0.1" step="0.1" bind:value={s.kw} /><span>kW</span></div></div>
      </div>
      <div class="two">
        <div class="field"><label for="b-bprijs">Prijs incl. btw en installatie</label><div class="input"><span>€</span><input id="b-bprijs" type="number" min="0" step="50" bind:value={s.bprijs} /></div></div>
        <div class="field"><label for="b-life">Levensduur</label><div class="input"><input id="b-life" type="number" min="1" max="25" step="1" bind:value={s.levensduur} /><span>jaar</span></div></div>
      </div>
      <div class="two">
        <div class="field"><label for="b-rend">Rendement (heen en terug)</label><div class="input"><input id="b-rend" type="number" min="50" max="100" step="1" bind:value={s.rendement} /><span>%</span></div></div>
        <div class="field"><label for="b-sb">Eigen verbruik batterij</label><div class="input"><input id="b-sb" type="number" min="0" step="1" bind:value={s.standby} /><span>watt</span></div></div>
      </div>
    </fieldset>
  </form>

  <section class="result" aria-live="polite" aria-label="Uitkomst">
    <div class="headline {res.oordeel}">
      <p class="verdict">{word[res.oordeel]}</p>
      <p class="big">{res.terugverdientijd != null ? `Terugverdiend na ${yrs(res.terugverdientijd)}` : 'Verdient zich niet terug'}</p>
      <p class="sub">Bespaart {eur(res.besparing)} per jaar bij een prijs van {eur(battery.prijs)} en een levensduur van ongeveer {battery.levensduur} jaar. Over die hele periode {res.resultaat >= 0 ? 'houd je' : 'verlies je'} <strong>{eur(Math.abs(res.resultaat))}</strong> {res.resultaat >= 0 ? 'over' : ''}.</p>
      <dl class="facts">
        <div><dt>Zelf gebruikt zonder batterij</dt><dd>{pct(res.eigenZonder)}</dd></div>
        <div><dt>Met batterij</dt><dd>{pct(res.eigenMet)}</dd></div>
        <div><dt>Volle laadbeurten per jaar</dt><dd>{Math.round(res.cycli)}</dd></div>
      </dl>
    </div>

    <DayCurve curve={res.met.dag.zomer} label="Gemiddelde zomerdag met batterij" prijs={s.prijs} netto={netto(contract)} compact />
    <p class="note">In de winter staat de batterij meestal leeg: er is dan te weinig zonnestroom over om op te slaan.</p>

    <div class="sens">
      <h3>Wat als de stroomprijs anders is?</h3>
      <div class="table-wrap">
        <table class="data">
          <thead><tr><th>Stroomprijs per kWh</th><th class="num">Besparing per jaar</th><th class="num">Terugverdiend na</th></tr></thead>
          <tbody>{#each gevoelig as g}<tr><td>{g.p.toLocaleString('nl-NL', { style: 'currency', currency: 'EUR' })}</td><td class="num">{eur(g.r.besparing)}</td><td class="num">{yrs(g.r.terugverdientijd)}</td></tr>{/each}</tbody>
        </table>
      </div>
      <p class="note">Ter vergelijking: Vereniging Eigen Huis en CE Delft maten 10 tot 22 jaar voor een gemiddeld huishouden; de Consumentenbond rekent met ongeveer 15 jaar.</p>
    </div>

    <p><button class="btn" type="button" onclick={share}>{copied ? 'Link gekopieerd' : 'Kopieer link naar deze berekening'}</button></p>
    {#if res.oordeel === 'loont'}<Affiliate kind="offertes" context="Volgens deze berekening kan een batterij bij jou lonen. Vraag meerdere offertes en vergelijk de prijs per kWh opslag." />{/if}
    <p class="note">Een schatting zonder handel op een dynamisch contract, inclusief 21% btw (terugvragen kan alleen als je handelt en btw-ondernemer wordt; <a href="/btw-thuisbatterij">lees meer</a>). Er is geen landelijke subsidie. <a href="/zo-rekenen-we">Zo rekenen we</a>.</p>
  </section>
</div>

<style>
  .calc { display: grid; gap: 24px; margin-top: 24px; }
  @media (min-width: 960px) { .calc { grid-template-columns: minmax(0, 0.85fr) minmax(0, 1.15fr); align-items: start; } }
  .inputs { display: grid; gap: 16px; background: var(--paper); border-radius: var(--r); padding: 20px; }
  fieldset { border: 0; margin: 0; padding: 0; display: grid; gap: 14px; }
  fieldset + fieldset { border-top: 1px solid var(--line); padding-top: 16px; }
  legend { font-family: var(--display); font-weight: 650; font-size: var(--s1); margin-bottom: 8px; }
  .two { display: grid; gap: 12px; }
  @media (min-width: 520px) { .two { grid-template-columns: 1fr 1fr; align-items: end; } }
  .chips { display: flex; flex-wrap: wrap; gap: 6px; }
  .chips button { font: inherit; font-size: var(--s-1); border: 1.5px solid var(--line); background: transparent; color: var(--ink); border-radius: 999px; padding: 3px 12px; cursor: pointer; }
  .chips button.on { border-color: var(--ink); background: var(--ink); color: var(--paper); }
  .check { display: flex; gap: 10px; align-items: flex-start; }
  .check input { width: 20px; height: 20px; margin-top: 3px; accent-color: var(--ink); }
  .result { display: grid; gap: 16px; }
  .headline { background: #13233a; color: #eaf0f5; border-radius: var(--r); padding: 20px 22px; border-top: 6px solid #94a0ae; }
  .headline.loont { border-top-color: #49c08a; }
  .headline.twijfel { border-top-color: #f0a12a; }
  .verdict { margin: 0 0 2px; font-weight: 700; }
  .big { font-family: var(--display); font-size: clamp(1.6rem, 1.2rem + 1.6vw, 2.3rem); line-height: 1.1; margin: 0 0 8px; letter-spacing: -0.02em; }
  .sub { margin: 0; opacity: 0.92; }
  .facts { display: flex; flex-wrap: wrap; gap: 10px 28px; margin: 16px 0 0; }
  .facts div { display: grid; }
  .facts dt { font-size: var(--s-1); opacity: 0.8; }
  .facts dd { margin: 0; font-weight: 600; }
  .sens { background: var(--paper); border-radius: var(--r); padding: 16px 18px; }
  .sens h3 { margin: 0 0 8px; }
  p { margin: 0; }
</style>
