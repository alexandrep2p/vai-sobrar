import { compareYearMonths, type YearMonth } from '../shared/dates.js';
import type { BusinessErrorCode } from '../shared/errors.js';
import type { ClosedMonths } from './types.js';

export interface CloseMonthState {
  month: YearMonth;
  /** Mês corrente segundo o relógio. */
  currentMonth: YearMonth;
  closedMonths: ClosedMonths;
  /** Lançamentos do mês com status `PENDING`. */
  pendingTransactionCount: number;
  /** Ocorrências de recorrência projetadas no mês. */
  projectedOccurrenceCount: number;
  /** Faturas com `reference_month` = mês e status diferente de `PAID` (inclusive só com créditos). */
  unpaidInvoiceCount: number;
  /** Meses que possuem lançamentos (alocações de estorno não contam). */
  monthsWithTransactions: ReadonlySet<YearMonth>;
}

export type CanCloseResult = { canClose: true } | { canClose: false; code: BusinessErrorCode };

/**
 * financial-periods.md §4.1. Avalia na ordem da spec e retorna o primeiro motivo de recusa:
 * mês aberto, não futuro, lançamentos/ocorrências pendentes, faturas não pagas, fechamento
 * cronológico.
 */
export const canClose = (state: CloseMonthState): CanCloseResult => {
  const refuse = (code: BusinessErrorCode): CanCloseResult => ({ canClose: false, code });

  if (state.closedMonths.has(state.month)) return refuse('PERIOD_CLOSED');
  if (compareYearMonths(state.month, state.currentMonth) > 0) {
    return refuse('PERIOD_FUTURE_NOT_CLOSABLE');
  }
  if (state.pendingTransactionCount > 0 || state.projectedOccurrenceCount > 0) {
    return refuse('PERIOD_HAS_PENDING_TRANSACTIONS');
  }
  if (state.unpaidInvoiceCount > 0) return refuse('PERIOD_HAS_UNPAID_INVOICES');

  for (const earlier of state.monthsWithTransactions) {
    if (compareYearMonths(earlier, state.month) < 0 && !state.closedMonths.has(earlier)) {
      return refuse('PERIOD_PREVIOUS_NOT_CLOSED');
    }
  }
  return { canClose: true };
};
