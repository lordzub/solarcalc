export const eur = (v: number) => Math.round(v).toLocaleString('nl-NL', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
export const eur2 = (v: number) => v.toLocaleString('nl-NL', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const ct = (v: number) => (v * 100).toLocaleString('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const pct = (v: number) => `${Math.round(v * 100)}%`;
export const kwh = (v: number) => Math.round(v).toLocaleString('nl-NL');
export const yrs = (v: number | null) => (v == null ? 'niet terugverdiend' : `${v.toLocaleString('nl-NL', { maximumFractionDigits: 1 })} jaar`);
export const host = (url: string) => new URL(url).hostname.replace(/^www\./, '');
export const datum = (iso: string) => new Intl.DateTimeFormat('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(iso));
export const toolLink = (path: string, params: Record<string, string | number | boolean>) => {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) q.set(k, typeof v === 'boolean' ? (v ? '1' : '0') : String(v));
  return `${path}?${q.toString()}`;
};
