import { BusinessError } from '../shared/errors.js';
import { cents, type Cents } from '../shared/money.js';
import { splitCentsProportional } from './split-cents.js';

export type RefundStrategy = 'FIRST_INSTALLMENTS' | 'LAST_INSTALLMENTS' | 'PROPORTIONAL';

/** Lançamento (compra à vista, ocorrência de cartão ou parcela) que pode receber crédito. */
export interface RefundTargetItem {
  transactionId: string;
  /** Número da parcela (1 para compra à vista). */
  number: number;
  originalAmount: Cents;
  /** Soma das alocações anteriores neste lançamento. */
  allocatedAmount: Cents;
}

export type RefundTarget =
  | { kind: 'SINGLE'; item: RefundTargetItem }
  | { kind: 'PLAN'; installments: readonly RefundTargetItem[] };

export interface RefundAllocationResult {
  transactionId: string;
  amount: Cents;
}

/** refunds.md §5: saldo estornável = valor original − alocações anteriores. */
export const refundableBalance = (item: RefundTargetItem): Cents =>
  cents(item.originalAmount - item.allocatedAmount);

const itemsOf = (target: RefundTarget): readonly RefundTargetItem[] =>
  target.kind === 'SINGLE' ? [target.item] : target.installments;

/** Saldo estornável da compra inteira. */
export const refundableTotal = (target: RefundTarget): Cents =>
  cents(itemsOf(target).reduce((sum, item) => sum + refundableBalance(item), 0));

/**
 * refunds.md §5 e §7: valida o valor e distribui entre os lançamentos. Retorna somente
 * alocações > 0, em ordem crescente de parcela. A soma é exatamente `amount`.
 */
export const allocateRefund = (
  target: RefundTarget,
  amount: Cents,
  strategy?: RefundStrategy,
): RefundAllocationResult[] => {
  if (!Number.isSafeInteger(amount) || amount <= 0) {
    throw new RangeError(`Valor do estorno deve ser um inteiro positivo: ${amount}`);
  }
  if (amount > refundableTotal(target)) {
    throw new BusinessError(
      'REFUND_EXCEEDS_REMAINING_AMOUNT',
      'Valor do estorno acima do saldo estornável.',
      { amount, refundable: refundableTotal(target) },
    );
  }

  if (target.kind === 'SINGLE') {
    if (strategy !== undefined) throw new RangeError('Estratégia não se aplica a compra à vista.');
    return [{ transactionId: target.item.transactionId, amount }];
  }
  if (strategy === undefined) throw new RangeError('Estratégia obrigatória para compra parcelada.');

  const items = [...target.installments].sort((a, b) => a.number - b.number);
  const amounts = distribute(items, amount, strategy);
  return items.flatMap((item, i) => {
    const value = amounts[i] ?? 0;
    return value > 0 ? [{ transactionId: item.transactionId, amount: cents(value) }] : [];
  });
};

const distribute = (
  items: readonly RefundTargetItem[],
  amount: Cents,
  strategy: RefundStrategy,
): number[] => {
  if (strategy === 'PROPORTIONAL') {
    return splitCentsProportional(amount, items.map(refundableBalance));
  }
  const order = items.map((_, i) => i);
  if (strategy === 'LAST_INSTALLMENTS') order.reverse();
  const result = items.map(() => 0);
  let left: number = amount;
  for (const index of order) {
    const item = items[index];
    if (left === 0 || !item) break;
    const take = Math.min(refundableBalance(item), left);
    result[index] = take;
    left -= take;
  }
  return result;
};
