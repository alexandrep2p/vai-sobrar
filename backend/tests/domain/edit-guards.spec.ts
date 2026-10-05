import { describe, it, expect } from 'vitest';
import {
  assertAllowed,
  canDeletePlan,
  canDeleteTransaction,
  canEditField,
  canEditPlanStructure,
  dueDateMoveVerdict,
  invoiceAcceptsPurchase,
  invoiceAcceptsRefundCredit,
  invoiceModificationVerdict,
  monthOperationVerdict,
  paymentMethodChangeVerdict,
  type EditableField,
  type TransactionEditContext,
  type Verdict,
} from '../../src/domain/edit-guards.js';
import { BusinessError } from '../../src/shared/errors.js';
import { d, m, invoice, closed } from './helpers.js';

const FIELDS: EditableField[] = [
  'description',
  'amount',
  'dueDate',
  'purchaseDate',
  'category',
  'paymentMethod',
  'status',
];

const YES: Verdict = { allowed: true };
const verdicts = (ctx: TransactionEditContext) => FIELDS.map((f) => canEditField(ctx, f).allowed);
const open = (ctx: Omit<TransactionEditContext, 'monthClosed'>): TransactionEditContext => ({
  ...ctx,
  monthClosed: false,
  invoicePaid: false,
});

describe('canEditField — matriz de transactions.md §12 (mês aberto)', () => {
  // ordem: description, amount, dueDate, purchaseDate, category, paymentMethod, status
  it('MANUAL', () => {
    expect(verdicts(open({ origin: 'MANUAL' }))).toEqual([
      true,
      true,
      true,
      false,
      true,
      true,
      true,
    ]);
  });

  it('RECURRENCE com método comum (categoria pertence à recorrência)', () => {
    expect(verdicts(open({ origin: 'RECURRENCE', recurrencePaidWithCard: false }))).toEqual([
      true,
      true,
      true,
      false,
      false,
      true,
      true,
    ]);
  });

  it('RECURRENCE com cartão, fatura não paga (CA-TRA-21)', () => {
    expect(verdicts(open({ origin: 'RECURRENCE', recurrencePaidWithCard: true }))).toEqual([
      true,
      true,
      false,
      false,
      false,
      false,
      false,
    ]);
  });

  it('CREDIT_CARD, fatura não paga', () => {
    expect(verdicts(open({ origin: 'CREDIT_CARD' }))).toEqual([
      true,
      false,
      false,
      false,
      true,
      false,
      false,
    ]);
  });

  it('INSTALLMENT com plano inteiro editável', () => {
    const ctx = open({
      origin: 'INSTALLMENT',
      planInstallments: [{ monthClosed: false, invoicePaid: false }],
    });
    expect(verdicts(ctx)).toEqual([true, false, false, false, true, false, false]);
  });

  it('INSTALLMENT com parcela em mês fechado ou em fatura PAID → rejeita descrição/categoria (CA-PAR-09)', () => {
    for (const bad of [
      { monthClosed: true, invoicePaid: false },
      { monthClosed: false, invoicePaid: true },
    ]) {
      const ctx = open({
        origin: 'INSTALLMENT',
        planInstallments: [{ monthClosed: false, invoicePaid: false }, bad],
      });
      expect(canEditField(ctx, 'description')).toEqual({
        allowed: false,
        code: 'INVALID_INSTALLMENT_OPERATION',
      });
      expect(canEditField(ctx, 'category').allowed).toBe(false);
    }
  });

  it('status de cartão só via pagamento de fatura (CA-TRA-19)', () => {
    for (const ctx of [
      open({ origin: 'CREDIT_CARD' }),
      open({ origin: 'INSTALLMENT' }),
      open({ origin: 'RECURRENCE', recurrencePaidWithCard: true }),
    ]) {
      expect(canEditField(ctx, 'status')).toEqual({
        allowed: false,
        code: 'CARD_TRANSACTION_SETTLED_BY_INVOICE',
      });
    }
  });

  it('valor e cartão de compra de cartão são imutáveis (CA-TRA-16)', () => {
    expect(canEditField(open({ origin: 'CREDIT_CARD' }), 'amount')).toEqual({
      allowed: false,
      code: 'TRANSACTION_NOT_EDITABLE',
    });
    expect(canEditField(open({ origin: 'CREDIT_CARD' }), 'paymentMethod').allowed).toBe(false);
  });
});

describe('canEditField — barreiras', () => {
  const origins: TransactionEditContext[] = [
    { origin: 'MANUAL', monthClosed: true },
    { origin: 'RECURRENCE', recurrencePaidWithCard: false, monthClosed: true },
    { origin: 'RECURRENCE', recurrencePaidWithCard: true, monthClosed: true },
    { origin: 'CREDIT_CARD', monthClosed: true },
    { origin: 'INSTALLMENT', monthClosed: true, planInstallments: [] },
  ];

  it('mês fechado bloqueia tudo (CA-TRA-13)', () => {
    for (const ctx of origins) {
      for (const field of FIELDS) {
        expect(canEditField(ctx, field)).toEqual({ allowed: false, code: 'PERIOD_CLOSED' });
      }
    }
  });

  it('fatura PAID bloqueia todos os campos de lançamento de cartão (CA-TRA-20, CA-FAT-19)', () => {
    const paidCtx: TransactionEditContext[] = [
      { origin: 'CREDIT_CARD', monthClosed: false, invoicePaid: true },
      { origin: 'INSTALLMENT', monthClosed: false, invoicePaid: true, planInstallments: [] },
      { origin: 'RECURRENCE', recurrencePaidWithCard: true, monthClosed: false, invoicePaid: true },
    ];
    for (const ctx of paidCtx) {
      for (const field of FIELDS) {
        expect(canEditField(ctx, field)).toEqual({ allowed: false, code: 'INVOICE_ALREADY_PAID' });
      }
    }
  });

  it('status de lançamento comum é reversível com o mês aberto', () => {
    expect(canEditField(open({ origin: 'MANUAL' }), 'status')).toEqual(YES);
  });
});

describe('paymentMethodChangeVerdict (CA-TRA-17)', () => {
  it('só entre métodos comuns', () => {
    expect(paymentMethodChangeVerdict(false, false)).toEqual(YES);
    expect(paymentMethodChangeVerdict(false, true).allowed).toBe(false);
    expect(paymentMethodChangeVerdict(true, false).allowed).toBe(false);
  });
});

describe('canDeleteTransaction (CA-TRA-15)', () => {
  it('MANUAL com mês aberto', () => {
    expect(canDeleteTransaction({ origin: 'MANUAL', monthClosed: false })).toEqual(YES);
  });

  it('MANUAL em mês fechado', () => {
    expect(canDeleteTransaction({ origin: 'MANUAL', monthClosed: true })).toEqual({
      allowed: false,
      code: 'PERIOD_CLOSED',
    });
  });

  it('PD-38: compra de cartão e ocorrência podem ser apagadas com mês aberto e fatura não paga', () => {
    for (const origin of ['CREDIT_CARD', 'RECURRENCE'] as const) {
      expect(canDeleteTransaction({ origin, monthClosed: false, invoicePaid: false })).toEqual(YES);
      expect(canDeleteTransaction({ origin, monthClosed: false })).toEqual(YES);
    }
  });

  it('fatura paga bloqueia a exclusão de compra de cartão', () => {
    for (const origin of ['CREDIT_CARD', 'RECURRENCE'] as const) {
      expect(canDeleteTransaction({ origin, monthClosed: false, invoicePaid: true })).toEqual({
        allowed: false,
        code: 'INVOICE_ALREADY_PAID',
      });
    }
  });

  it('mês fechado bloqueia qualquer origem (antes da fatura paga)', () => {
    for (const origin of ['MANUAL', 'CREDIT_CARD', 'RECURRENCE'] as const) {
      expect(canDeleteTransaction({ origin, monthClosed: true, invoicePaid: true })).toEqual({
        allowed: false,
        code: 'PERIOD_CLOSED',
      });
    }
  });

  it('parcela isolada nunca é apagada; apaga-se o plano inteiro', () => {
    expect(canDeleteTransaction({ origin: 'INSTALLMENT', monthClosed: false })).toEqual({
      allowed: false,
      code: 'TRANSACTION_NOT_DELETABLE',
    });
  });
});

describe('canDeletePlan (PD-38)', () => {
  const free = { monthClosed: false, invoicePaid: false };

  it('permite plano inteiro em meses abertos e faturas não pagas', () => {
    expect(canDeletePlan([free, free])).toEqual(YES);
  });

  it('rejeita parcela em mês fechado ou em fatura PAID', () => {
    expect(canDeletePlan([free, { monthClosed: true, invoicePaid: false }])).toEqual({
      allowed: false,
      code: 'PERIOD_CLOSED',
    });
    expect(canDeletePlan([{ monthClosed: false, invoicePaid: true }, free])).toEqual({
      allowed: false,
      code: 'INVOICE_ALREADY_PAID',
    });
  });
});

describe('dueDateMoveVerdict (CA-TRA-11, CA-TRA-12)', () => {
  it('entre meses abertos', () => {
    expect(dueDateMoveVerdict(d('2027-09-15'), d('2027-10-05'), closed())).toEqual(YES);
    expect(dueDateMoveVerdict(d('2027-09-15'), d('2027-09-10'), closed())).toEqual(YES);
  });

  it('origem ou destino em mês fechado', () => {
    expect(dueDateMoveVerdict(d('2027-09-15'), d('2027-08-31'), closed('2027-08')).allowed).toBe(
      false,
    );
    expect(dueDateMoveVerdict(d('2027-09-15'), d('2027-10-01'), closed('2027-09')).allowed).toBe(
      false,
    );
  });
});

describe('barreira de fatura e de mês', () => {
  const none = closed();

  it('fatura PAID nunca é modificada; de mês fechado também não', () => {
    expect(
      invoiceModificationVerdict(invoice('2027-10', '2027-10-06', '2027-10-15', 'PAID'), none),
    ).toEqual({
      allowed: false,
      code: 'INVOICE_ALREADY_PAID',
    });
    expect(
      invoiceModificationVerdict(
        invoice('2027-10', '2027-10-06', '2027-10-15', 'OPEN'),
        closed('2027-10'),
      ),
    ).toEqual({ allowed: false, code: 'PERIOD_CLOSED' });
  });

  it('compra entra em OPEN e CLOSED, não em PAID (invoices §5.1)', () => {
    for (const status of ['OPEN', 'CLOSED'] as const) {
      expect(
        invoiceAcceptsPurchase(invoice('2027-10', '2027-10-06', '2027-10-15', status), none),
      ).toEqual(YES);
    }
    expect(
      invoiceAcceptsPurchase(invoice('2027-10', '2027-10-06', '2027-10-15', 'PAID'), none).allowed,
    ).toBe(false);
  });

  it('crédito de estorno só entra em OPEN', () => {
    expect(
      invoiceAcceptsRefundCredit(invoice('2027-10', '2027-10-06', '2027-10-15', 'OPEN'), none),
    ).toEqual(YES);
    expect(
      invoiceAcceptsRefundCredit(invoice('2027-10', '2027-10-06', '2027-10-15', 'CLOSED'), none),
    ).toEqual({
      allowed: false,
      code: 'INVOICE_NOT_OPEN_FOR_CREDIT',
    });
    expect(
      invoiceAcceptsRefundCredit(invoice('2027-10', '2027-10-06', '2027-10-15', 'PAID'), none)
        .allowed,
    ).toBe(false);
  });

  it('monthOperationVerdict e assertAllowed', () => {
    expect(monthOperationVerdict(m('2027-10'), none)).toEqual(YES);
    const denied = monthOperationVerdict(m('2027-10'), closed('2027-10'));
    expect(() => assertAllowed(denied)).toThrow(BusinessError);
    expect(() => assertAllowed(YES)).not.toThrow();
  });
});

describe('canEditPlanStructure (PD-36)', () => {
  const free = { monthClosed: false, invoicePaid: false };

  it('permite plano inteiro em meses abertos, faturas não pagas e sem estorno', () => {
    expect(canEditPlanStructure({ installments: [free, free], hasRefunds: false })).toEqual({
      allowed: true,
    });
  });

  it('rejeita parcela em mês fechado', () => {
    expect(
      canEditPlanStructure({
        installments: [free, { monthClosed: true, invoicePaid: false }],
        hasRefunds: false,
      }),
    ).toEqual({ allowed: false, code: 'PERIOD_CLOSED' });
  });

  it('rejeita parcela em fatura PAID', () => {
    expect(
      canEditPlanStructure({
        installments: [{ monthClosed: false, invoicePaid: true }, free],
        hasRefunds: false,
      }),
    ).toEqual({ allowed: false, code: 'INVOICE_ALREADY_PAID' });
  });

  it('rejeita plano com estorno vinculado', () => {
    expect(canEditPlanStructure({ installments: [free], hasRefunds: true })).toEqual({
      allowed: false,
      code: 'INVALID_INSTALLMENT_OPERATION',
    });
  });
});
