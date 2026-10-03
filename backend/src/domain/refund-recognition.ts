import { addMonths, compareLocalDates, type LocalDate } from '../shared/dates.js';
import { BusinessError } from '../shared/errors.js';
import { cycleOf, findInvoice, newInvoice } from './posting.js';
import type { CardConfig, ClosedMonths, InvoiceChoice, InvoiceSnapshot } from './types.js';

const MAX_CYCLES = 1200;

/** refunds.md §6: `purchase_date <= refund_date <= hoje`. */
export const validateRefundDate = (
  purchaseDate: LocalDate,
  refundDate: LocalDate,
  today: LocalDate,
): void => {
  if (compareLocalDates(refundDate, purchaseDate) < 0 || compareLocalDates(refundDate, today) > 0) {
    throw new BusinessError('INVALID_REFUND_DATE', 'Data do estorno inválida.', {
      purchaseDate,
      refundDate,
      today,
    });
  }
};

/** refunds.md §8 (PD-23): só fatura `OPEN` com mês financeiro aberto recebe crédito. */
export const canReceiveRefundCredit = (
  invoice: Pick<InvoiceSnapshot, 'status' | 'referenceMonth'>,
  closedMonths: ClosedMonths,
): boolean => invoice.status === 'OPEN' && !closedMonths.has(invoice.referenceMonth);

/**
 * refunds.md §8: fatura em que a alocação é reconhecida.
 * 1. fatura do lançamento-alvo, se puder receber crédito;
 * 2. fatura do ciclo da `refund_date` (como se fosse data de compra) ou, se não puder, a
 *    próxima do cartão que possa. Ciclo sem fatura persistida com fechamento passado, ou
 *    de mês fechado, é pulado sem criar fatura vazia.
 */
export const recognitionInvoice = (
  card: CardConfig,
  targetInvoice: InvoiceSnapshot,
  refundDate: LocalDate,
  invoices: readonly InvoiceSnapshot[],
  closedMonths: ClosedMonths,
  today: LocalDate,
): InvoiceChoice => {
  if (canReceiveRefundCredit(targetInvoice, closedMonths)) {
    return { needsCreation: false, invoice: targetInvoice };
  }

  let month = cycleOf(card, refundDate, invoices);
  for (let i = 0; i < MAX_CYCLES; i += 1) {
    if (!closedMonths.has(month)) {
      const existing = findInvoice(invoices, month);
      if (existing) {
        if (canReceiveRefundCredit(existing, closedMonths)) {
          return { needsCreation: false, invoice: existing };
        }
      } else {
        const created = newInvoice(card, month, today);
        if (created.invoice.status === 'OPEN') return created;
      }
    }
    month = addMonths(month, 1);
  }
  throw new RangeError('Nenhuma fatura disponível para reconhecer o crédito.');
};
