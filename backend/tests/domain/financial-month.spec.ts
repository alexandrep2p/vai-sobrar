import { describe, it, expect } from 'vitest';
import { financialMonth } from '../../src/domain/financial-month.js';
import { postingInvoice } from '../../src/domain/posting.js';
import { d, m, closed } from './helpers.js';

describe('financialMonth', () => {
  it('método comum → mês do due_date', () => {
    expect(financialMonth({ kind: 'COMMON_TRANSACTION', dueDate: d('2027-09-15') })).toBe(
      '2027-09',
    );
    expect(financialMonth({ kind: 'COMMON_TRANSACTION', dueDate: d('2027-10-02') })).toBe(
      '2027-10',
    );
  });

  it('lançamento de cartão → reference_month da fatura', () => {
    expect(financialMonth({ kind: 'CARD_TRANSACTION', invoiceReferenceMonth: m('2027-11') })).toBe(
      '2027-11',
    );
  });

  it('cartão com vencimento no mês seguinte nunca usa mês(due_date)', () => {
    const card = { bestPurchaseDay: 25, dueDay: 5 };
    const posted = postingInvoice(card, d('2027-10-20'), [], closed(), d('2027-10-20')).invoice;
    expect(posted.dueDate).toBe('2027-11-05');
    expect(
      financialMonth({ kind: 'CARD_TRANSACTION', invoiceReferenceMonth: posted.referenceMonth }),
    ).toBe('2027-10');
  });

  it('ocorrência projetada usa a regra do item correspondente', () => {
    expect(
      financialMonth({
        kind: 'PROJECTED_OCCURRENCE',
        projected: { kind: 'COMMON_TRANSACTION', dueDate: d('2028-02-29') },
      }),
    ).toBe('2028-02');
    expect(
      financialMonth({
        kind: 'PROJECTED_OCCURRENCE',
        projected: { kind: 'CARD_TRANSACTION', invoiceReferenceMonth: m('2028-03') },
      }),
    ).toBe('2028-03');
  });

  it('alocação de estorno → reference_month da fatura de reconhecimento', () => {
    expect(financialMonth({ kind: 'REFUND_ALLOCATION', invoiceReferenceMonth: m('2027-06') })).toBe(
      '2027-06',
    );
  });

  it('paid_at nunca altera o mês', () => {
    const item = {
      kind: 'COMMON_TRANSACTION',
      dueDate: d('2027-10-02'),
      paidAt: d('2027-09-29'),
    } as const;
    expect(financialMonth(item)).toBe('2027-10');
  });
});
