import type { Invoice } from '@prisma/client';
import { closingDate, dueDate } from '../../domain/card-dates.js';
import { invoiceTotals, type InvoiceTotals } from '../../domain/invoice-totals.js';
import {
  addMonths,
  compareLocalDates,
  compareYearMonths,
  yearMonthOf,
  type LocalDate,
  type YearMonth,
} from '../../shared/dates.js';
import {
  fromDbDate,
  fromDbDateOrNull,
  lockCard,
  lockPeriodsShared,
  toDbDate,
  TRANSACTION_OPTIONS,
  type Db,
} from '../../shared/db.js';
import type { AppContext } from '../../shared/context.js';
import { BusinessError } from '../../shared/errors.js';
import { cents } from '../../shared/money.js';
import { findCardOrThrow } from '../credit-cards/credit-cards.service.js';
import { loadClosedMonths } from '../financial-periods/periods.service.js';
import { loadActiveMethod, assertPaidAtValid } from '../transactions/transactions.service.js';
import {
  toTransactionDto,
  transactionInclude,
  type TransactionDto,
} from '../transactions/transaction-dto.js';
import { cardConfigOf } from './invoice-store.js';

export type InvoiceSituation = 'OVERDUE' | null;

export interface InvoiceSummaryDto {
  id: string | null;
  credit_card_id: string;
  reference_month: string;
  closing_date: LocalDate;
  due_date: LocalDate;
  status: 'OPEN' | 'CLOSED' | 'PAID';
  /** `OVERDUE` quando `CLOSED` com vencimento passado, independentemente do valor (invoices.md §6). */
  situation: InvoiceSituation;
  /** `false` para ciclos projetados (sem fatura persistida, "Sem lançamentos"). */
  persisted: boolean;
  paid_at: LocalDate | null;
  payment_method_id: string | null;
  credit_balance: number;
  credit_transferred_to_invoice_id: string | null;
  totals: {
    debits: number;
    credits: number;
    received_credit: number;
    amount_due: number;
    credit_balance: number;
  };
}

export interface InvoiceDetailDto extends InvoiceSummaryDto {
  card_name: string;
  transactions: TransactionDto[];
  credits: {
    allocation_id: string;
    refund_id: string;
    refund_date: LocalDate;
    transaction_id: string;
    description: string;
    amount: number;
  }[];
  received_credits: { invoice_id: string; reference_month: string; amount: number }[];
}

const situationOf = (
  status: Invoice['status'],
  due: LocalDate,
  today: LocalDate,
): InvoiceSituation =>
  status === 'CLOSED' && compareLocalDates(due, today) < 0 ? 'OVERDUE' : null;

const totalsDto = (t: InvoiceTotals): InvoiceSummaryDto['totals'] => ({
  debits: t.debits,
  credits: t.credits,
  received_credit: t.receivedCredit,
  amount_due: t.amountDue,
  credit_balance: t.creditBalance,
});

/** Totais de várias faturas de uma vez (débitos, créditos e crédito recebido — invoices.md §7). */
export const computeTotalsMap = async (
  db: Db,
  invoiceIds: readonly string[],
): Promise<Map<string, InvoiceTotals>> => {
  const [debits, credits, received] = await Promise.all([
    db.transaction.groupBy({
      by: ['invoiceId'],
      where: { invoiceId: { in: [...invoiceIds] } },
      _sum: { amount: true },
    }),
    db.refundAllocation.groupBy({
      by: ['invoiceId'],
      where: { invoiceId: { in: [...invoiceIds] } },
      _sum: { amount: true },
    }),
    db.invoice.groupBy({
      by: ['creditTransferredToInvoiceId'],
      where: { creditTransferredToInvoiceId: { in: [...invoiceIds] } },
      _sum: { creditBalance: true },
    }),
  ]);
  const debitBy = new Map(debits.map((r) => [r.invoiceId, r._sum.amount ?? 0]));
  const creditBy = new Map(credits.map((r) => [r.invoiceId, r._sum.amount ?? 0]));
  const receivedBy = new Map(
    received.map((r) => [r.creditTransferredToInvoiceId, r._sum.creditBalance ?? 0]),
  );

  return new Map(
    invoiceIds.map((id) => [
      id,
      invoiceTotals({
        debits: [cents(debitBy.get(id) ?? 0)],
        credits: [cents(creditBy.get(id) ?? 0)],
        receivedCredits: [cents(receivedBy.get(id) ?? 0)],
      }),
    ]),
  );
};

export const computeInvoiceTotals = async (db: Db, invoiceId: string): Promise<InvoiceTotals> => {
  const map = await computeTotalsMap(db, [invoiceId]);
  return map.get(invoiceId) as InvoiceTotals;
};

const toSummary = (
  invoice: Invoice,
  totals: InvoiceTotals,
  today: LocalDate,
): InvoiceSummaryDto => {
  const due = fromDbDate(invoice.dueDate);
  return {
    id: invoice.id,
    credit_card_id: invoice.creditCardId,
    reference_month: invoice.referenceMonth,
    closing_date: fromDbDate(invoice.closingDate),
    due_date: due,
    status: invoice.status,
    situation: situationOf(invoice.status, due, today),
    persisted: true,
    paid_at: fromDbDateOrNull(invoice.paidAt),
    payment_method_id: invoice.paymentMethodId,
    credit_balance: invoice.creditBalance,
    credit_transferred_to_invoice_id: invoice.creditTransferredToInvoiceId,
    totals: totalsDto(totals),
  };
};

const findInvoiceOrThrow = async (db: Db, id: string): Promise<Invoice> => {
  const invoice = await db.invoice.findUnique({ where: { id } });
  if (!invoice) throw new BusinessError('INVOICE_NOT_FOUND', 'Fatura não encontrada.');
  return invoice;
};

// ---------- Listagem: persistidas + ciclos projetados vazios (invoices.md §4) ----------

const MAX_RANGE_MONTHS = 60;

export const listCardInvoices = async (
  { prisma, clock }: AppContext,
  cardId: string,
  range: { from?: YearMonth | undefined; to?: YearMonth | undefined },
): Promise<InvoiceSummaryDto[]> => {
  const card = await findCardOrThrow(prisma, cardId);
  const today = clock.today();
  const from = range.from ?? yearMonthOf(today);
  const to = range.to ?? addMonths(from, 11);
  if (compareYearMonths(from, to) > 0) {
    throw new BusinessError('INVALID_DUE_DATE', 'O intervalo de meses é inválido.');
  }
  const span =
    (Number(to.slice(0, 4)) - Number(from.slice(0, 4))) * 12 +
    Number(to.slice(5)) -
    Number(from.slice(5));
  if (span >= MAX_RANGE_MONTHS) {
    throw new BusinessError('INVALID_DUE_DATE', 'O intervalo de meses é grande demais.');
  }

  const all = await prisma.invoice.findMany({
    where: { creditCardId: cardId },
    orderBy: { referenceMonth: 'asc' },
  });
  const persisted = all.filter((i) => i.referenceMonth >= from && i.referenceMonth <= to);
  const totals = await computeTotalsMap(
    prisma,
    persisted.map((i) => i.id),
  );
  const byMonth = new Map(persisted.map((i) => [i.referenceMonth, i]));
  const lastPersisted = all.at(-1)?.referenceMonth as YearMonth | undefined;
  const config = cardConfigOf(card);

  const result: InvoiceSummaryDto[] = [];
  for (let month = from; compareYearMonths(month, to) <= 0; month = addMonths(month, 1)) {
    const existing = byMonth.get(month);
    if (existing) {
      const t = totals.get(existing.id) as InvoiceTotals;
      result.push(toSummary(existing, t, today));
      continue;
    }
    // Cartão desativado deixa de aparecer na visão futura depois da última fatura (credit-cards §13).
    if (
      !card.paymentMethod.active &&
      (!lastPersisted || compareYearMonths(month, lastPersisted) > 0)
    ) {
      continue;
    }
    const closing = closingDate(config, month);
    const due = dueDate(config, closing);
    result.push({
      id: null,
      credit_card_id: cardId,
      reference_month: month,
      closing_date: closing,
      due_date: due,
      status: compareLocalDates(closing, today) < 0 ? 'CLOSED' : 'OPEN',
      situation: null,
      persisted: false,
      paid_at: null,
      payment_method_id: null,
      credit_balance: 0,
      credit_transferred_to_invoice_id: null,
      totals: { debits: 0, credits: 0, received_credit: 0, amount_due: 0, credit_balance: 0 },
    });
  }
  return result;
};

// ---------- Detalhe ----------

export const buildInvoiceDetail = async (
  db: Db,
  invoice: Invoice,
  today: LocalDate,
): Promise<InvoiceDetailDto> => {
  const [card, transactions, allocations, receivedFrom, totals] = await Promise.all([
    findCardOrThrow(db, invoice.creditCardId),
    db.transaction.findMany({
      where: { invoiceId: invoice.id },
      include: transactionInclude,
      orderBy: [{ purchaseDate: 'asc' }, { createdAt: 'asc' }],
    }),
    db.refundAllocation.findMany({
      where: { invoiceId: invoice.id },
      include: { refund: true, transaction: true },
      orderBy: { createdAt: 'asc' },
    }),
    db.invoice.findMany({
      where: { creditTransferredToInvoiceId: invoice.id },
      orderBy: { referenceMonth: 'asc' },
    }),
    computeInvoiceTotals(db, invoice.id),
  ]);
  return {
    ...toSummary(invoice, totals, today),
    card_name: card.paymentMethod.name,
    transactions: transactions.map(toTransactionDto),
    credits: allocations.map((a) => ({
      allocation_id: a.id,
      refund_id: a.refundId,
      refund_date: fromDbDate(a.refund.refundDate),
      transaction_id: a.transactionId,
      description: a.transaction.description,
      amount: a.amount,
    })),
    received_credits: receivedFrom.map((i) => ({
      invoice_id: i.id,
      reference_month: i.referenceMonth,
      amount: i.creditBalance,
    })),
  };
};

export const getInvoice = async (
  { prisma, clock }: AppContext,
  id: string,
): Promise<InvoiceDetailDto> =>
  buildInvoiceDetail(prisma, await findInvoiceOrThrow(prisma, id), clock.today());

// ---------- Pagamento (invoices.md §9) ----------

/**
 * Pagar fatura: liquida atomicamente os lançamentos, marca a fatura `PAID` e apura/transfere o
 * saldo credor para a próxima fatura não paga do cartão (ou deixa pendente até existir uma).
 */
export const payInvoice = async (
  ctx: AppContext,
  id: string,
  input: { paidAt: LocalDate; paymentMethodId: string },
): Promise<InvoiceDetailDto> => {
  const today = ctx.clock.today();
  return ctx.prisma.$transaction(async (tx) => {
    const head = await findInvoiceOrThrow(tx, id);
    await lockCard(tx, head.creditCardId);
    await lockPeriodsShared(tx);
    const invoice = await findInvoiceOrThrow(tx, id);
    const closed = await loadClosedMonths(tx);

    if (invoice.status === 'PAID') {
      throw new BusinessError('INVOICE_ALREADY_PAID', 'A fatura já foi paga.');
    }
    if (invoice.status !== 'CLOSED') {
      throw new BusinessError('INVOICE_NOT_CLOSED', 'Só faturas fechadas podem ser pagas.');
    }
    if (closed.has(invoice.referenceMonth as YearMonth)) {
      throw new BusinessError('PERIOD_CLOSED', `O mês ${invoice.referenceMonth} está fechado.`);
    }
    assertPaidAtValid(input.paidAt, today, closed);

    const card = await findCardOrThrow(tx, invoice.creditCardId);
    if (input.paymentMethodId === card.paymentMethodId) {
      throw new BusinessError(
        'INVOICE_PAYMENT_METHOD_INVALID',
        'A fatura não pode ser paga com o próprio cartão.',
      );
    }
    await loadActiveMethod(tx, input.paymentMethodId);

    const paidAt = toDbDate(input.paidAt);
    await tx.transaction.updateMany({
      where: { invoiceId: id },
      data: { status: 'PAID', paidAt },
    });

    const totals = await computeInvoiceTotals(tx, id);
    let transferTo: string | null = null;
    if (totals.creditBalance > 0) {
      const next = await tx.invoice.findFirst({
        where: {
          creditCardId: invoice.creditCardId,
          referenceMonth: { gt: invoice.referenceMonth },
          status: { not: 'PAID' },
        },
        orderBy: { referenceMonth: 'asc' },
      });
      transferTo = next?.id ?? null;
    }
    const paid = await tx.invoice.update({
      where: { id },
      data: {
        status: 'PAID',
        paidAt,
        paymentMethodId: input.paymentMethodId,
        creditBalance: totals.creditBalance,
        creditTransferredToInvoiceId: transferTo,
      },
    });
    return buildInvoiceDetail(tx, paid, today);
  }, TRANSACTION_OPTIONS);
};
