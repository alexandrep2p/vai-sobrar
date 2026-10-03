import {
  addMonths,
  compareLocalDates,
  yearMonthOf,
  type LocalDate,
  type YearMonth,
} from '../shared/dates.js';
import { closingDate, dueDate } from './card-dates.js';
import type { CardConfig, ClosedMonths, InvoiceChoice, InvoiceSnapshot } from './types.js';

/** Limite de segurança para a varredura de ciclos; meses fechados são finitos. */
const MAX_CYCLES = 1200;

export const findInvoice = (
  invoices: readonly InvoiceSnapshot[],
  month: YearMonth,
): InvoiceSnapshot | undefined => invoices.find((invoice) => invoice.referenceMonth === month);

/** Fatura ainda não persistida do ciclo `month`, com a configuração vigente (credit-cards.md §8.3). */
export const newInvoice = (card: CardConfig, month: YearMonth, today: LocalDate): InvoiceChoice => {
  const closing = closingDate(card, month);
  return {
    needsCreation: true,
    invoice: {
      referenceMonth: month,
      closingDate: closing,
      dueDate: dueDate(card, closing),
      status: compareLocalDates(closing, today) < 0 ? 'CLOSED' : 'OPEN',
    },
  };
};

/**
 * credit-cards.md §8.1: ciclo M se `purchase_date <= closing_date(M)`, senão M+1,
 * sendo M o mês da `purchase_date`. Retorna o mês de referência do ciclo.
 */
export const cycleOf = (
  card: CardConfig,
  purchaseDate: LocalDate,
  invoices: readonly InvoiceSnapshot[],
): YearMonth => {
  const month = yearMonthOf(purchaseDate);
  const closing = closingDate(card, month, findInvoice(invoices, month));
  return compareLocalDates(purchaseDate, closing) <= 0 ? month : addMonths(month, 1);
};

/**
 * credit-cards.md §8.2 / architecture §11.1: fatura do ciclo da compra, exceto quando
 * `PAID` ou de mês fechado — nesse caso, a próxima fatura não paga com mês aberto
 * (compra tardia), percorrendo os ciclos em ordem.
 */
export const postingInvoice = (
  card: CardConfig,
  purchaseDate: LocalDate,
  invoices: readonly InvoiceSnapshot[],
  closedMonths: ClosedMonths,
  today: LocalDate,
): InvoiceChoice => {
  let month = cycleOf(card, purchaseDate, invoices);
  for (let i = 0; i < MAX_CYCLES; i += 1) {
    if (!closedMonths.has(month)) {
      const existing = findInvoice(invoices, month);
      if (!existing) return newInvoice(card, month, today);
      if (existing.status !== 'PAID') return { needsCreation: false, invoice: existing };
    }
    month = addMonths(month, 1);
  }
  throw new RangeError('Nenhuma fatura disponível para postagem.');
};
