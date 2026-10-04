import { describe, it, expect } from 'vitest';
import { canClose, type CloseMonthState } from '../../src/domain/can-close.js';
import { m, closed } from './helpers.js';

const base = (overrides: Partial<CloseMonthState> = {}): CloseMonthState => ({
  month: m('2027-09'),
  currentMonth: m('2027-10'),
  closedMonths: closed(),
  pendingTransactionCount: 0,
  projectedOccurrenceCount: 0,
  unpaidInvoiceCount: 0,
  monthsWithTransactions: new Set([m('2027-09')]),
  ...overrides,
});

const codeOf = (state: CloseMonthState) => {
  const result = canClose(state);
  return result.canClose ? 'OK' : result.code;
};

describe('canClose', () => {
  it('todas as pré-condições atendidas', () => {
    expect(canClose(base())).toEqual({ canClose: true });
  });

  it('mês já fechado → PERIOD_CLOSED', () => {
    expect(codeOf(base({ closedMonths: closed('2027-09') }))).toBe('PERIOD_CLOSED');
  });

  it('mês futuro → PERIOD_FUTURE_NOT_CLOSABLE (CA-PER-05B)', () => {
    expect(codeOf(base({ month: m('2027-11') }))).toBe('PERIOD_FUTURE_NOT_CLOSABLE');
  });

  it('mês corrente pode ser fechado antes do último dia (CA-PER-05C)', () => {
    expect(
      codeOf(base({ month: m('2027-10'), monthsWithTransactions: new Set([m('2027-10')]) })),
    ).toBe('OK');
  });

  it('lançamento PENDING → PERIOD_HAS_PENDING_TRANSACTIONS (CA-PER-03)', () => {
    expect(codeOf(base({ pendingTransactionCount: 1 }))).toBe('PERIOD_HAS_PENDING_TRANSACTIONS');
  });

  it('ocorrência projetada → PERIOD_HAS_PENDING_TRANSACTIONS (CA-PER-04)', () => {
    expect(codeOf(base({ projectedOccurrenceCount: 1 }))).toBe('PERIOD_HAS_PENDING_TRANSACTIONS');
  });

  it('fatura não paga, inclusive só com créditos → PERIOD_HAS_UNPAID_INVOICES (CA-PER-04A)', () => {
    expect(codeOf(base({ unpaidInvoiceCount: 1 }))).toBe('PERIOD_HAS_UNPAID_INVOICES');
  });

  it('mês anterior aberto com lançamentos → PERIOD_PREVIOUS_NOT_CLOSED (CA-PER-05)', () => {
    const state = base({ monthsWithTransactions: new Set([m('2027-08'), m('2027-09')]) });
    expect(codeOf(state)).toBe('PERIOD_PREVIOUS_NOT_CLOSED');
  });

  it('mês anterior sem lançamentos não bloqueia (CA-PER-05A)', () => {
    expect(codeOf(base({ monthsWithTransactions: new Set([m('2027-09')]) }))).toBe('OK');
  });

  it('mês anterior com lançamentos já fechado não bloqueia; meses posteriores são ignorados', () => {
    const state = base({
      closedMonths: closed('2027-08'),
      monthsWithTransactions: new Set([m('2027-08'), m('2027-09'), m('2027-10')]),
    });
    expect(codeOf(state)).toBe('OK');
  });

  it('virada de ano: dezembro anterior aberto bloqueia janeiro', () => {
    const state = base({
      month: m('2028-01'),
      currentMonth: m('2028-01'),
      monthsWithTransactions: new Set([m('2027-12'), m('2028-01')]),
    });
    expect(codeOf(state)).toBe('PERIOD_PREVIOUS_NOT_CLOSED');
  });
});
