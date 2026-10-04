import type { MonthlyStatement, StatementItem } from '../app/core/api/models';

/** Item de extrato padrão: lançamento manual de saída, pendente, com método comum. */
export function statementItem(over: Partial<StatementItem> = {}): StatementItem {
  return {
    item_type: 'TRANSACTION',
    display_date: '2027-01-05',
    description: 'Aluguel',
    amount: 150000,
    signed_amount: -150000,
    nature: 'EXPENSE',
    status: 'PENDING',
    transaction_id: 't1',
    origin: 'MANUAL',
    category: { id: 'cat1', name: 'Moradia' },
    payment_method: { id: 'pm1', name: 'PIX' },
    credit_card: null,
    invoice: null,
    purchase_date: null,
    due_date: '2027-01-05',
    installment: null,
    recurrence_id: null,
    occurrence_month: null,
    refund: null,
    ...over,
  };
}

export const cardItem = (over: Partial<StatementItem> = {}): StatementItem =>
  statementItem({
    origin: 'CREDIT_CARD',
    description: 'Supermercado',
    amount: 64000,
    signed_amount: -64000,
    transaction_id: 't-card',
    payment_method: { id: 'pm-card', name: 'Nubank' },
    credit_card: { id: 'card1', name: 'Nubank' },
    invoice: { id: 'inv1', reference_month: '2027-01', due_date: '2027-01-15', status: 'OPEN' },
    purchase_date: '2026-12-20',
    due_date: null,
    display_date: '2026-12-20',
    ...over,
  });

export const installmentItem = (over: Partial<StatementItem> = {}): StatementItem =>
  cardItem({
    origin: 'INSTALLMENT',
    description: 'Mercado Livre — Coxim do motor',
    amount: 5900,
    signed_amount: -5900,
    transaction_id: 't-inst',
    installment: { number: 2, installment_count: 10, installment_plan_id: 'plan1' },
    ...over,
  });

export const recurrenceItem = (over: Partial<StatementItem> = {}): StatementItem =>
  statementItem({
    origin: 'RECURRENCE',
    description: 'Internet',
    amount: 12000,
    signed_amount: -12000,
    transaction_id: 't-rec',
    recurrence_id: 'rec1',
    occurrence_month: '2027-01',
    ...over,
  });

export const projectedItem = (over: Partial<StatementItem> = {}): StatementItem =>
  recurrenceItem({
    item_type: 'PROJECTED_OCCURRENCE',
    transaction_id: null,
    status: 'PENDING',
    ...over,
  });

export const refundCreditItem = (over: Partial<StatementItem> = {}): StatementItem =>
  statementItem({
    item_type: 'REFUND_CREDIT',
    description: 'Estorno — Tênis',
    amount: 10000,
    signed_amount: 10000,
    status: null,
    transaction_id: null,
    origin: null,
    credit_card: { id: 'card1', name: 'Nubank' },
    refund: { refund_id: 'r1', original_transaction_id: 't-orig' },
    due_date: null,
    display_date: '2027-01-03',
    ...over,
  });

export function statement(
  items: StatementItem[],
  over: Partial<MonthlyStatement> = {},
): MonthlyStatement {
  return {
    month: { reference_month: '2027-01', status: 'OPEN', closed_at: null },
    totals: { incomes: 880000, expenses: 275900, balance: 604100 },
    items,
    ...over,
  };
}
