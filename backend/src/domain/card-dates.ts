import {
  addMonths,
  compareLocalDates,
  dateInMonth,
  lastDayOfMonth,
  yearMonthOf,
  type LocalDate,
  type YearMonth,
} from '../shared/dates.js';
import type { CardConfig, InvoiceSnapshot } from './types.js';

/** credit-cards.md §5: dia_efetivo(d, mês) = min(d, último_dia(mês)). */
export const effectiveDay = (day: number, month: YearMonth): number => {
  if (!Number.isInteger(day) || day < 1 || day > 31) {
    throw new RangeError(`Dia configurado deve estar entre 1 e 31: ${day}`);
  }
  return Math.min(day, lastDayOfMonth(month));
};

/**
 * credit-cards.md §6.1–§6.2: usa o `closing_date` gravado quando a fatura do mês existe;
 * senão calcula com a configuração vigente do cartão.
 */
export const closingDate = (
  card: CardConfig,
  month: YearMonth,
  persistedInvoice?: Pick<InvoiceSnapshot, 'closingDate'>,
): LocalDate =>
  persistedInvoice?.closingDate ?? dateInMonth(month, effectiveDay(card.bestPurchaseDay, month));

/**
 * credit-cards.md §6.3: primeira data com o dia de vencimento efetivo estritamente
 * posterior ao fechamento.
 */
export const dueDate = (card: CardConfig, closing: LocalDate): LocalDate => {
  const month = yearMonthOf(closing);
  const sameMonth = dateInMonth(month, effectiveDay(card.dueDay, month));
  if (compareLocalDates(sameMonth, closing) > 0) return sameMonth;
  const next = addMonths(month, 1);
  return dateInMonth(next, effectiveDay(card.dueDay, next));
};
