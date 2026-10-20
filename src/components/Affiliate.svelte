<script lang="ts">
  // Plain outbound link, shown only under results. Never carries user inputs.
  import { AFFILIATES } from '../site';
  let { kind, context }: { kind: keyof typeof AFFILIATES; context: string } = $props();
  const a = AFFILIATES[kind];
</script>

<aside class="aff" aria-label="Gesponsorde link">
  <p>{context}</p>
  <a href={a.href} rel="sponsored nofollow noopener" target="_blank" data-pending={a.pending ? 'true' : undefined}>{a.text}</a>
  <small>Gesponsorde link: we krijgen mogelijk een vergoeding. Dat verandert niets aan de berekening of de volgorde. <a href="/hoe-verdienen-wij-geld">Meer hierover</a>.</small>
</aside>

<style>
  .aff { margin-top: 14px; padding: 12px 14px; border: 1.5px dashed var(--line); border-radius: 8px; font-size: var(--s-1); }
  .aff p { margin: 0 0 4px; }
  .aff > a { font-weight: 700; }
  small { display: block; color: var(--ink-soft); margin-top: 6px; }
</style>
