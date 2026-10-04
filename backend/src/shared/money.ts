/** Valor monetário em centavos inteiros. Nunca usar ponto flutuante para dinheiro. */
export type Cents = number & { readonly __brand: 'Cents' };

export const isCents = (value: unknown): value is Cents =>
  typeof value === 'number' && Number.isSafeInteger(value);

export const cents = (value: number): Cents => {
  if (!isCents(value)) {
    throw new RangeError(`Valor em centavos deve ser um inteiro seguro: ${String(value)}`);
  }
  return value;
};

export const addCents = (a: Cents, b: Cents): Cents => cents(a + b);
export const subtractCents = (a: Cents, b: Cents): Cents => cents(a - b);

/** Converte texto decimal ("12.34", "-0.5", "7") em centavos, sem passar por float. Máx. 2 casas. */
export const centsFromDecimalString = (text: string): Cents => {
  const match = /^(-?)(\d+)(?:\.(\d{1,2}))?$/.exec(text.trim());
  if (!match) throw new RangeError(`Valor decimal inválido: ${text}`);
  const [, sign, units, fraction = ''] = match;
  const total = Number(units) * 100 + Number(fraction.padEnd(2, '0'));
  return cents(sign === '-' ? -total : total);
};

/** Formata centavos como texto decimal com 2 casas (1234 -> "12.34"). */
export const centsToDecimalString = (value: Cents): string => {
  const abs = Math.abs(value);
  const units = Math.floor(abs / 100);
  const fraction = String(abs % 100).padStart(2, '0');
  return `${value < 0 ? '-' : ''}${units}.${fraction}`;
};
