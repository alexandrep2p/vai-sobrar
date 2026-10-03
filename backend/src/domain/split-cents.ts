import { cents, type Cents } from '../shared/money.js';

/**
 * installments.md §6: piso para todos; os centavos restantes vão, um a um, para as
 * últimas posições.
 */
export const splitCents = (total: Cents, n: number): Cents[] => {
  if (!Number.isInteger(n) || n < 1) throw new RangeError(`Quantidade inválida: ${n}`);
  if (total < 0) throw new RangeError(`Total não pode ser negativo: ${total}`);
  const base = Math.floor(total / n);
  const rest = total - base * n;
  return Array.from({ length: n }, (_, i) => cents(i >= n - rest ? base + 1 : base));
};

/**
 * refunds.md §7.3: rateio proporcional a `weights`. Cada participante (peso > 0) recebe o
 * piso da sua cota; os centavos restantes vão, um a um, para os últimos participantes.
 * Não participantes recebem 0. A soma é exatamente `total`.
 */
export const splitCentsProportional = (total: Cents, weights: readonly Cents[]): Cents[] => {
  if (total < 0) throw new RangeError(`Total não pode ser negativo: ${total}`);
  if (weights.some((w) => w < 0)) throw new RangeError('Pesos não podem ser negativos.');
  const weightSum = weights.reduce((sum, w) => sum + w, 0);
  if (weightSum === 0) {
    if (total === 0) return weights.map(() => cents(0));
    throw new RangeError('Soma dos pesos é zero.');
  }

  // BigInt evita perda de precisão em total * peso.
  const shares = weights.map((w) => Number((BigInt(total) * BigInt(w)) / BigInt(weightSum)));
  const rest = total - shares.reduce((sum, s) => sum + s, 0);

  const participants = weights.flatMap((w, i) => (w > 0 ? [i] : []));
  for (const index of participants.slice(participants.length - rest)) {
    shares[index] = (shares[index] ?? 0) + 1;
  }
  return shares.map((s) => cents(s));
};
