import type { Invoice } from '@prisma/client';
import {
  dueDate as computeDueDate,
  closingDate as computeClosingDate,
} from '../../domain/card-dates.js';
import { postingInvoice } from '../../domain/posting.js';
import type { CardConfig, InvoiceChoice, InvoiceSnapshot } from '../../domain/types.js';
import { compareLocalDates, type LocalDate, type YearMonth } from '../../shared/dates.js';
import { fromDbDate, lockPeriodsShared, toDbDate, type Db, type Tx } from '../../shared/db.js';
import { BusinessError } from '../../shared/errors.js';
import { loadClosedMonths } from '../financial-periods/periods.service.js';

export const toSnapshot = (invoice: Invoice): InvoiceSnapshot => ({
  referenceMonth: invoice.referenceMonth as YearMonth,
  closingDate: fromDbDate(invoice.closingDate),
  dueDate: fromDbDate(invoice.dueDate),
  status: invoice.status,
});

export const loadCardInvoices = (db: Db, creditCardId: string): Promise<Invoice[]> =>
  db.invoice.findMany({ where: { creditCardId }, orderBy: { referenceMonth: 'asc' } });

export const cardConfigOf = (card: { bestPurchaseDay: number; dueDay: number }): CardConfig => ({
  bestPurchaseDay: card.bestPurchaseDay,
  dueDay: card.dueDay,
});

/** invoices.md §5: `OPEN → CLOSED` quando a data atual passa do `closing_date`. Idempotente. */
export const syncInvoiceStatuses = async (db: Db, today: LocalDate): Promise<number> => {
  const result = await db.invoice.updateMany({
    where: { status: 'OPEN', closingDate: { lt: toDbDate(today) } },
    data: { status: 'CLOSED' },
  });
  return result.count;
};

/**
 * Persiste (se necessário) a fatura escolhida pelo domínio. A criação é idempotente sob
 * concorrência (`ON CONFLICT DO NOTHING` sobre `(credit_card_id, reference_month)`).
 * Ao criar uma fatura, vincula saldos credores pendentes de faturas pagas anteriores
 * do mesmo cartão (invoices.md §8).
 */
export const ensureInvoice = async (
  tx: Tx,
  creditCardId: string,
  choice: InvoiceChoice,
  known: readonly Invoice[],
): Promise<Invoice> => {
  if (!choice.needsCreation) {
    const found = known.find((i) => i.referenceMonth === choice.invoice.referenceMonth);
    if (found) return found;
    const fresh = await tx.invoice.findUnique({
      where: {
        creditCardId_referenceMonth: {
          creditCardId,
          referenceMonth: choice.invoice.referenceMonth,
        },
      },
    });
    if (!fresh) throw new BusinessError('INVOICE_NOT_FOUND', 'Fatura não encontrada.');
    return fresh;
  }

  const { referenceMonth, closingDate, dueDate, status } = choice.invoice;
  // SQL cru não passa pelo escopo do usuário: o dono da fatura é o dono do cartão (PD-40).
  const inserted = await tx.$executeRaw`
    INSERT INTO invoices
      (id, user_id, credit_card_id, reference_month, closing_date, due_date, status, credit_balance,
       created_at, updated_at)
    SELECT
      gen_random_uuid(), cc.user_id, cc.id, ${referenceMonth}, ${toDbDate(closingDate)}::date,
      ${toDbDate(dueDate)}::date, ${status}::invoice_status, 0, now(), now()
    FROM credit_cards cc
    WHERE cc.id = ${creditCardId}::uuid
    ON CONFLICT (credit_card_id, reference_month) DO NOTHING`;

  const invoice = await tx.invoice.findUniqueOrThrow({
    where: { creditCardId_referenceMonth: { creditCardId, referenceMonth } },
  });

  if (inserted > 0) {
    await tx.invoice.updateMany({
      where: {
        creditCardId,
        status: 'PAID',
        creditBalance: { gt: 0 },
        creditTransferredToInvoiceId: null,
        referenceMonth: { lt: referenceMonth },
      },
      data: { creditTransferredToInvoiceId: invoice.id },
    });
  }
  return invoice;
};

/**
 * invoices.md §4: ciclo sem lançamentos, créditos de estorno nem crédito recebido não fica
 * persistido. Remove as faturas informadas que ficaram nessa situação (nunca uma `PAID`).
 */
export const pruneEmptyInvoices = async (tx: Tx, invoiceIds: Iterable<string>): Promise<void> => {
  for (const invoiceId of new Set(invoiceIds)) {
    const [invoice, transactions, allocations, received] = await Promise.all([
      tx.invoice.findUnique({ where: { id: invoiceId }, select: { status: true } }),
      tx.transaction.count({ where: { invoiceId } }),
      tx.refundAllocation.count({ where: { invoiceId } }),
      tx.invoice.count({ where: { creditTransferredToInvoiceId: invoiceId } }),
    ]);
    if (invoice && invoice.status !== 'PAID' && !transactions && !allocations && !received) {
      await tx.invoice.delete({ where: { id: invoiceId } });
    }
  }
};

export interface PostingResult {
  invoice: Invoice;
}

/**
 * Fatura de postagem de uma compra de cartão (credit-cards.md §8, architecture §11.1), criando-a
 * se preciso. Deve rodar em transação, com o lock do cartão e o lock compartilhado de meses.
 */
export const postingInvoiceFor = async (
  tx: Tx,
  card: { id: string; bestPurchaseDay: number; dueDay: number },
  purchaseDate: LocalDate,
  today: LocalDate,
): Promise<Invoice> => {
  await lockPeriodsShared(tx);
  const invoices = await loadCardInvoices(tx, card.id);
  const closed = await loadClosedMonths(tx);
  const choice = postingInvoice(
    cardConfigOf(card),
    purchaseDate,
    invoices.map(toSnapshot),
    closed,
    today,
  );
  return ensureInvoice(tx, card.id, choice, invoices);
};

/**
 * Fatura de um ciclo específico (parcelas k ≥ 2: "ciclo imediatamente seguinte"). Cria se
 * preciso; rejeita ciclo cuja fatura não pode receber lançamentos.
 */
export const invoiceForCycle = async (
  tx: Tx,
  card: { id: string; bestPurchaseDay: number; dueDay: number },
  month: YearMonth,
  today: LocalDate,
): Promise<Invoice> => {
  await lockPeriodsShared(tx);
  const invoices = await loadCardInvoices(tx, card.id);
  const closed = await loadClosedMonths(tx);
  const existing = invoices.find((i) => i.referenceMonth === month);
  if (existing) {
    if (closed.has(month)) throw new BusinessError('PERIOD_CLOSED', `O mês ${month} está fechado.`);
    if (existing.status === 'PAID') {
      throw new BusinessError('INVOICE_ALREADY_PAID', 'A fatura do ciclo já foi paga.');
    }
    return existing;
  }
  if (closed.has(month)) throw new BusinessError('PERIOD_CLOSED', `O mês ${month} está fechado.`);
  const closing = computeClosingDate(cardConfigOf(card), month);
  const choice: InvoiceChoice = {
    needsCreation: true,
    invoice: {
      referenceMonth: month,
      closingDate: closing,
      dueDate: computeDueDate(cardConfigOf(card), closing),
      status: compareLocalDates(closing, today) < 0 ? 'CLOSED' : 'OPEN',
    },
  };
  return ensureInvoice(tx, card.id, choice, invoices);
};
