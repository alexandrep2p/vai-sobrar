import { describe, it, expect } from 'vitest';
import {
  allocateRefund,
  type RefundTarget,
  type RefundTargetItem,
} from '../../src/domain/refund-allocation.js';
import { BusinessError } from '../../src/shared/errors.js';
import { c } from './helpers.js';

const item = (number: number, original: number, allocated = 0): RefundTargetItem => ({
  transactionId: `t${number}`,
  number,
  originalAmount: c(original),
  allocatedAmount: c(allocated),
});
const plan = (...items: RefundTargetItem[]): RefundTarget => ({
  kind: 'PLAN',
  installments: items,
});
const amounts = (result: { amount: number }[]): number[] => result.map((r) => r.amount);
const four = (allocated: number[] = [0, 0, 0, 0]): RefundTarget =>
  plan(...allocated.map((a, i) => item(i + 1, 10000, a)));

describe('allocateRefund — compra única', () => {
  const single = (original: number, allocated = 0): RefundTarget => ({
    kind: 'SINGLE',
    item: item(1, original, allocated),
  });

  it('uma única alocação no próprio lançamento', () => {
    expect(allocateRefund(single(30000), c(10000))).toEqual([
      { transactionId: 't1', amount: 10000 },
    ]);
  });

  it('estorno total', () => {
    expect(amounts(allocateRefund(single(30000), c(30000)))).toEqual([30000]);
  });

  it('pedido acima do saldo é rejeitado; igual ao saldo é aceito (CA-EST-03)', () => {
    const target = single(50000, 30000);
    expect(() => allocateRefund(target, c(25000))).toThrow(BusinessError);
    try {
      allocateRefund(target, c(25000));
    } catch (error) {
      expect((error as BusinessError).code).toBe('REFUND_EXCEEDS_REMAINING_AMOUNT');
    }
    expect(amounts(allocateRefund(target, c(20000)))).toEqual([20000]);
  });

  it('rejeita valor não positivo e estratégia em compra à vista', () => {
    expect(() => allocateRefund(single(100), c(0))).toThrow(RangeError);
    expect(() => allocateRefund(single(100), c(-1))).toThrow(RangeError);
    expect(() => allocateRefund(single(100), c(50), 'PROPORTIONAL')).toThrow(RangeError);
  });
});

describe('allocateRefund — compra parcelada', () => {
  it('FIRST_INSTALLMENTS: 100 / 50 (CA-EST-07)', () => {
    expect(allocateRefund(four(), c(15000), 'FIRST_INSTALLMENTS')).toEqual([
      { transactionId: 't1', amount: 10000 },
      { transactionId: 't2', amount: 5000 },
    ]);
  });

  it('LAST_INSTALLMENTS: 50 / 100 (CA-EST-08)', () => {
    expect(allocateRefund(four(), c(15000), 'LAST_INSTALLMENTS')).toEqual([
      { transactionId: 't3', amount: 5000 },
      { transactionId: 't4', amount: 10000 },
    ]);
  });

  it('PROPORTIONAL: 30 / 30 / 30 (CA-EST-09)', () => {
    const target = plan(item(1, 10000), item(2, 10000), item(3, 10000));
    expect(amounts(allocateRefund(target, c(9000), 'PROPORTIONAL'))).toEqual([3000, 3000, 3000]);
  });

  it('PROPORTIONAL usa os valores reais das parcelas (CA-EST-10)', () => {
    const target = plan(item(1, 3333), item(2, 3333), item(3, 3334));
    expect(amounts(allocateRefund(target, c(10000), 'PROPORTIONAL'))).toEqual([3333, 3333, 3334]);
    const partial = allocateRefund(target, c(5001), 'PROPORTIONAL');
    expect(partial.reduce((s, a) => s + a.amount, 0)).toBe(5001);
  });

  it('com estornos anteriores: FIRST pula parcela esgotada e respeita o saldo', () => {
    const result = allocateRefund(four([10000, 4000, 0, 0]), c(8000), 'FIRST_INSTALLMENTS');
    expect(result).toEqual([
      { transactionId: 't2', amount: 6000 },
      { transactionId: 't3', amount: 2000 },
    ]);
  });

  it('com estornos anteriores: LAST respeita o saldo da parcela', () => {
    const result = allocateRefund(four([0, 0, 0, 7000]), c(5000), 'LAST_INSTALLMENTS');
    expect(result).toEqual([
      { transactionId: 't3', amount: 2000 },
      { transactionId: 't4', amount: 3000 },
    ]);
  });

  it('com estornos anteriores: PROPORTIONAL usa o saldo como peso', () => {
    // saldos: 10000, 5000, 5000, 0 → total 20000; estorno de 10000 = metade de cada
    const result = allocateRefund(four([0, 5000, 5000, 10000]), c(10000), 'PROPORTIONAL');
    expect(amounts(result)).toEqual([5000, 2500, 2500]);
  });

  it('estorno total zera todos os saldos', () => {
    const result = allocateRefund(four(), c(40000), 'PROPORTIONAL');
    expect(amounts(result)).toEqual([10000, 10000, 10000, 10000]);
  });

  it('soma = valor estornado e nenhuma alocação acima do saldo (todas as estratégias)', () => {
    const target = plan(
      item(1, 3333, 100),
      item(2, 3333, 0),
      item(3, 3334, 3334),
      item(4, 3333, 33),
    );
    const total = 3233 + 3333 + 0 + 3300;
    for (const strategy of ['FIRST_INSTALLMENTS', 'LAST_INSTALLMENTS', 'PROPORTIONAL'] as const) {
      for (let amount = 1; amount <= total; amount += 97) {
        const result = allocateRefund(target, c(amount), strategy);
        expect(result.reduce((s, a) => s + a.amount, 0)).toBe(amount);
        for (const allocation of result) {
          const found =
            target.kind === 'PLAN' &&
            target.installments.find((i) => i.transactionId === allocation.transactionId);
          expect(found).toBeTruthy();
          if (found)
            expect(allocation.amount).toBeLessThanOrEqual(
              found.originalAmount - found.allocatedAmount,
            );
        }
      }
    }
  });

  it('exige estratégia e rejeita pedido acima do saldo do plano', () => {
    expect(() => allocateRefund(four(), c(100))).toThrow(RangeError);
    expect(() => allocateRefund(four(), c(40001), 'FIRST_INSTALLMENTS')).toThrow(BusinessError);
  });
});
