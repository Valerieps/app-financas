// Money as the screens write it, in reais: "R$ 1.200,00" in tables, "R$ 1,2 mil" next to a bar,
// "R$ 62" in a sentence. Spaces are plain, so the text reads the same everywhere.
const plain = (text: string) => text.replace(/\s/g, ' ');

/** "R$ 1.200,00". */
export function money(cents: number): string {
  return plain((cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }));
}

/** Whole reais: "R$ 62", "R$ 1.200". */
export function moneyWhole(cents: number): string {
  return plain(Math.round(cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0, minimumFractionDigits: 0 }));
}

/** Next to a bar: "R$ 412", "R$ 1,2 mil", "R$ 15 mil". */
export function moneyShort(cents: number): string {
  const reais = Math.round(cents / 100);
  if (Math.abs(reais) < 1000) return moneyWhole(cents);
  const thousands = reais / 1000;
  const digits = Math.abs(thousands) < 10 ? 1 : 0;
  return `R$ ${thousands.toLocaleString('pt-BR', { maximumFractionDigits: digits, minimumFractionDigits: 0 })} mil`;
}

/** A difference: "+ R$ 14,30", "− R$ 21,10". */
export function moneyDiff(cents: number): string {
  return `${cents < 0 ? '−' : '+'} ${money(Math.abs(cents))}`;
}
