import { compareLocalDates, dateInMonth, type LocalDate, type YearMonth } from '../shared/dates.js';
import { effectiveDay } from './card-dates.js';
import type { ClosedMonths } from './types.js';

export type RecurrenceStatus = 'ACTIVE' | 'PAUSED' | 'CANCELLED';

/** Campos da recorrência usados na elegibilidade (recurrences.md §3). */
export interface RecurrenceRule {
  /** 1..31 */
  dueDay: number;
  startDate: LocalDate;
  /** Data de criação da recorrência (sem ocorrência retroativa). */
  createdOn: LocalDate;
  endDate?: LocalDate | undefined;
  status: RecurrenceStatus;
  /** Data do cancelamento; relevante quando `status = CANCELLED`. */
  cancelledOn?: LocalDate | undefined;
  pausedFrom?: LocalDate | undefined;
  /** Retorno programado; a pausa vale até a véspera desta data. */
  pausedUntil?: LocalDate | undefined;
}

/** Estado externo necessário para a elegibilidade de um mês. */
export interface OccurrenceState {
  /** Há `RecurrenceException` para o mês. */
  hasException: boolean;
  /** Método de pagamento (inclusive cartão) ativo na data da ocorrência. */
  paymentMethodActive: boolean;
  /** Categoria ativa na data da ocorrência. */
  categoryActive: boolean;
  /** O método da recorrência é um cartão de crédito. */
  paidWithCard: boolean;
  closedMonths: ClosedMonths;
}

export type IneligibilityReason =
  | 'BEFORE_START_OR_CREATION'
  | 'AFTER_END_DATE'
  | 'CANCELLED'
  | 'PAUSED'
  | 'SKIPPED'
  | 'PAYMENT_METHOD_INACTIVE'
  | 'CATEGORY_INACTIVE'
  | 'PERIOD_CLOSED';

export type OccurrenceEligibility =
  | {
      eligible: true;
      date: LocalDate;
      /** Para cartão, a data da ocorrência funciona como `purchase_date` (recurrences.md §13). */
      purchaseDate?: LocalDate;
    }
  | { eligible: false; reason: IneligibilityReason; date: LocalDate };

/** recurrences.md §4: data(M, dia_efetivo(due_day, M)). */
export const occurrenceDate = (dueDay: number, month: YearMonth): LocalDate =>
  dateInMonth(month, effectiveDay(dueDay, month));

const isPaused = (rule: RecurrenceRule, date: LocalDate): boolean =>
  rule.pausedFrom !== undefined &&
  compareLocalDates(date, rule.pausedFrom) >= 0 &&
  (rule.pausedUntil === undefined || compareLocalDates(date, rule.pausedUntil) < 0);

/** recurrences.md §5: as sete condições de elegibilidade, avaliadas na ordem da spec. */
export const occurrenceEligibility = (
  rule: RecurrenceRule,
  month: YearMonth,
  state: OccurrenceState,
): OccurrenceEligibility => {
  const date = occurrenceDate(rule.dueDay, month);
  const no = (reason: IneligibilityReason): OccurrenceEligibility => ({
    eligible: false,
    reason,
    date,
  });

  if (compareLocalDates(date, rule.startDate) < 0 || compareLocalDates(date, rule.createdOn) < 0) {
    return no('BEFORE_START_OR_CREATION');
  }
  if (rule.endDate !== undefined && compareLocalDates(date, rule.endDate) > 0) {
    return no('AFTER_END_DATE');
  }
  if (
    rule.status === 'CANCELLED' &&
    (rule.cancelledOn === undefined || compareLocalDates(date, rule.cancelledOn) >= 0)
  ) {
    return no('CANCELLED');
  }
  if (isPaused(rule, date)) return no('PAUSED');
  if (state.hasException) return no('SKIPPED');
  if (!state.paymentMethodActive) return no('PAYMENT_METHOD_INACTIVE');
  if (!state.categoryActive) return no('CATEGORY_INACTIVE');
  if (!state.paidWithCard && state.closedMonths.has(month)) return no('PERIOD_CLOSED');

  return state.paidWithCard
    ? { eligible: true, date, purchaseDate: date }
    : { eligible: true, date };
};
