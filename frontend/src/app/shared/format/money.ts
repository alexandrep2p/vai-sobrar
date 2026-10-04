const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

/** Formata centavos inteiros como moeda (123456 -> "R$ 1.234,56"). */
export function formatCents(cents: number): string {
  if (!Number.isSafeInteger(cents)) {
    throw new RangeError(`Valor em centavos deve ser um inteiro: ${String(cents)}`);
  }
  const sign = cents < 0 ? '-' : '';
  const abs = Math.abs(cents);
  const reais = Math.trunc(abs / 100);
  const rest = String(abs % 100).padStart(2, '0');
  return sign + brl.format(Number(`${reais}.${rest}`));
}

const PLAIN = /^\d+(,\d{1,2})?$/;
const THOUSANDS = /^\d{1,3}(\.\d{3})+(,\d{1,2})?$/;
const DOT_DECIMAL = /^\d+\.\d{1,2}$/;

/**
 * Converte o texto digitado ("1.234,56", "12,5", "12.34", "100") em centavos inteiros, sem usar
 * ponto flutuante. Retorna `null` se o texto não for um valor monetário válido.
 */
export function parseCents(text: string): number | null {
  const raw = text.replace(/^R\$\s*/, '').trim();
  let normalized: string;
  if (PLAIN.test(raw)) normalized = raw;
  else if (THOUSANDS.test(raw)) normalized = raw.replace(/\./g, '');
  else if (DOT_DECIMAL.test(raw)) normalized = raw.replace('.', ',');
  else return null;
  const [reais, fraction = ''] = normalized.split(',');
  const cents = Number(reais) * 100 + Number(fraction.padEnd(2, '0'));
  return Number.isSafeInteger(cents) ? cents : null;
}

/** Centavos como texto editável ("123456" -> "1234,56"), sem símbolo de moeda. */
export function centsToInput(cents: number): string {
  const abs = Math.abs(cents);
  const text = `${Math.trunc(abs / 100)},${String(abs % 100).padStart(2, '0')}`;
  return cents < 0 ? `-${text}` : text;
}

/** Valor com sinal explícito para o extrato ("+ R$ 100,00" / "− R$ 59,00"). */
export function formatSignedCents(signedCents: number): string {
  const sign = signedCents < 0 ? '−' : '+';
  return `${sign} ${formatCents(Math.abs(signedCents))}`;
}
