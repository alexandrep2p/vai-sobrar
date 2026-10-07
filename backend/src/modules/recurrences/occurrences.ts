import { postingInvoice } from '../../domain/posting.js';
import {
  occurrenceDate,
  occurrenceEligibility,
  type OccurrenceEligibility,
} from '../../domain/recurrence-eligibility.js';
import {
  addDays,
  addMonths,
  compareLocalDates,
  compareYearMonths,
  yearMonthOf,
  type LocalDate,
  type YearMonth,
} from '../../shared/dates.js';
import {
  lockCard,
  lockJob,
  lockPeriodsShared,
  lockRecurrence,
  toDbDate,
  TRANSACTION_OPTIONS,
  type Db,
  type Tx,
} from '../../shared/db.js';
import type { AppContext } from '../../shared/context.js';
import { loadClosedMonths } from '../financial-periods/periods.service.js';
import {
  cardConfigOf,
  loadCardInvoices,
  postingInvoiceFor,
  toSnapshot,
} from '../invoices/invoice-store.js';
import { transactionInclude, type TransactionRow } from '../transactions/transaction-dto.js';
import { recurrenceInclude, toRule, type RecurrenceRow } from './recurrence-store.js';

// ---------- Elegibilidade com estado real ----------

export const evaluateOccurrence = async (
  db: Db,
  recurrence: RecurrenceRow,
  month: YearMonth,
  closedMonths: ReadonlySet<YearMonth>,
): Promise<OccurrenceEligibility> => {
  const exception = await db.recurrenceException.findUnique({
    where: {
      recurrenceId_occurrenceMonth: { recurrenceId: recurrence.id, occurrenceMonth: month },
    },
    select: { id: true },
  });
  return occurrenceEligibility(toRule(recurrence), month, {
    hasException: exception !== null,
    paymentMethodActive: recurrence.paymentMethod.active,
    categoryActive: recurrence.category.active,
    paidWithCard: recurrence.paymentMethod.kind === 'CREDIT_CARD',
    closedMonths,
  });
};

export const findOccurrenceTransaction = (
  db: Db,
  recurrenceId: string,
  month: YearMonth,
): Promise<TransactionRow | null> =>
  db.transaction.findUnique({
    where: { recurrenceId_occurrenceMonth: { recurrenceId, occurrenceMonth: month } },
    include: transactionInclude,
  });

// ---------- Projeção (T-29) ----------

export interface ProjectedOccurrence {
  recurrence: RecurrenceRow;
  occurrenceMonth: YearMonth;
  /** Data da ocorrência (`due_date` para método comum; `purchase_date` para cartão). */
  date: LocalDate;
  financialMonth: YearMonth;
  /** Vencimento: da recorrência (comum) ou da fatura projetada (cartão). */
  dueDate: LocalDate;
  invoice: { id: string | null; referenceMonth: YearMonth; dueDate: LocalDate } | null;
}

/**
 * recurrences.md §6: ocorrências elegíveis, com data futura, ainda não geradas, cujo mês
 * financeiro é `financialMonth`. Não persiste nada. Uma ocorrência de cartão cai no mês da
 * ocorrência ou no seguinte (fatura do ciclo), por isso os meses candidatos são M-1 e M.
 * Com `cardId`, considera só recorrências pagas com aquele cartão (previsão na fatura, PD-35).
 */
export const projectOccurrences = async (
  db: Db,
  today: LocalDate,
  financialMonth: YearMonth,
  options: { cardId?: string } = {},
): Promise<ProjectedOccurrence[]> => {
  const recurrences = await db.recurrence.findMany({
    where: {
      status: { not: 'CANCELLED' },
      ...(options.cardId && { paymentMethod: { creditCard: { id: options.cardId } } }),
    },
    include: recurrenceInclude,
    orderBy: { createdAt: 'asc' },
  });
  if (recurrences.length === 0) return [];
  const closed = await loadClosedMonths(db);
  const projected: ProjectedOccurrence[] = [];

  for (const recurrence of recurrences) {
    for (const month of [addMonths(financialMonth, -1), financialMonth]) {
      const eligibility = await evaluateOccurrence(db, recurrence, month, closed);
      if (!eligibility.eligible || compareLocalDates(eligibility.date, today) <= 0) continue;
      if (await findOccurrenceTransaction(db, recurrence.id, month)) continue;

      const card = recurrence.paymentMethod.creditCard;
      if (recurrence.paymentMethod.kind === 'CREDIT_CARD' && card) {
        const invoices = await loadCardInvoices(db, card.id);
        const choice = postingInvoice(
          cardConfigOf(card),
          eligibility.date,
          invoices.map(toSnapshot),
          closed,
          today,
        );
        if (choice.invoice.referenceMonth !== financialMonth) continue;
        const existing = invoices.find((i) => i.referenceMonth === choice.invoice.referenceMonth);
        projected.push({
          recurrence,
          occurrenceMonth: month,
          date: eligibility.date,
          financialMonth,
          dueDate: choice.invoice.dueDate,
          invoice: {
            id: existing?.id ?? null,
            referenceMonth: choice.invoice.referenceMonth,
            dueDate: choice.invoice.dueDate,
          },
        });
      } else if (month === financialMonth) {
        projected.push({
          recurrence,
          occurrenceMonth: month,
          date: eligibility.date,
          financialMonth,
          dueDate: eligibility.date,
          invoice: null,
        });
      }
    }
  }
  return projected;
};

// ---------- Geração (T-30) ----------

export interface GenerateOptions {
  /** Permite gerar ocorrência de data futura (interação do usuário: editar, pagar). */
  allowFuture: boolean;
}

/**
 * Persiste a ocorrência `(recorrência, mês)` se elegível — idempotente: se já existe, devolve
 * a existente; se há exceção ou não é elegível, devolve `null`. Ocorrência de cartão é uma compra
 * postada pela regra de `postingInvoice` com `purchase_date` = data da ocorrência.
 */
export const generateOccurrenceInTx = async (
  tx: Tx,
  today: LocalDate,
  recurrenceId: string,
  month: YearMonth,
  options: GenerateOptions,
): Promise<TransactionRow | null> => {
  await lockRecurrence(tx, recurrenceId);
  await lockPeriodsShared(tx);

  const existing = await findOccurrenceTransaction(tx, recurrenceId, month);
  if (existing) return existing;

  const recurrence = await tx.recurrence.findUniqueOrThrow({
    where: { id: recurrenceId },
    include: recurrenceInclude,
  });
  const closed = await loadClosedMonths(tx);
  const eligibility = await evaluateOccurrence(tx, recurrence, month, closed);
  if (!eligibility.eligible) return null;
  if (!options.allowFuture && compareLocalDates(eligibility.date, today) > 0) return null;

  const base = {
    userId: recurrence.userId,
    description: recurrence.description,
    amount: recurrence.amount,
    status: 'PENDING' as const,
    origin: 'RECURRENCE' as const,
    categoryId: recurrence.categoryId,
    paymentMethodId: recurrence.paymentMethodId,
    recurrenceId: recurrence.id,
    occurrenceMonth: month,
  };

  const card = recurrence.paymentMethod.creditCard;
  if (recurrence.paymentMethod.kind === 'CREDIT_CARD' && card) {
    await lockCard(tx, card.id);
    const invoice = await postingInvoiceFor(tx, card, eligibility.date, today);
    return tx.transaction.create({
      data: {
        ...base,
        financialMonth: invoice.referenceMonth,
        dueDate: invoice.dueDate,
        purchaseDate: toDbDate(eligibility.date),
        invoiceId: invoice.id,
      },
      include: transactionInclude,
    });
  }

  return tx.transaction.create({
    data: {
      ...base,
      financialMonth: yearMonthOf(eligibility.date),
      dueDate: toDbDate(eligibility.date),
    },
    include: transactionInclude,
  });
};

/** Marca d'água por usuário (PD-40): o acesso de um usuário não avança a marca de outro. */
export const watermarkKey = (userId: string): string => `occurrence_generation_watermark:${userId}`;

/**
 * Gera as ocorrências com data no intervalo `(marca d'água, hoje]`, com a configuração e o
 * estado de método/categoria vigentes (technical decision, architecture §26): a rotina roda a
 * cada acesso à API e periodicamente no servidor; a marca d'água garante que dias já processados
 * nunca sejam gerados retroativamente (reativação de método/categoria, fim de pausa). Eventos
 * que mudam a elegibilidade no próprio dia (criar, retomar, reativar) chamam com `fromToday`.
 */
export const generateDueOccurrences = async (
  ctx: AppContext,
  options: { fromToday?: boolean } = {},
): Promise<number> => {
  const { prisma, clock } = ctx;
  const today = clock.today();
  const markKey = watermarkKey(ctx.userId);
  const mark = await prisma.jobState.findUnique({ where: { key: markKey } });
  const markDate = mark ? (mark.value as LocalDate) : null;

  let start: LocalDate;
  if (options.fromToday || markDate === null) start = today;
  else start = addDays(markDate, 1);
  if (compareLocalDates(start, today) > 0) return 0;

  const recurrences = await prisma.recurrence.findMany({ select: { id: true } });
  let generated = 0;
  for (const { id } of recurrences) {
    for (
      let month = yearMonthOf(start);
      compareYearMonths(month, yearMonthOf(today)) <= 0;
      month = addMonths(month, 1)
    ) {
      const recurrence = await prisma.recurrence.findUniqueOrThrow({
        where: { id },
        include: recurrenceInclude,
      });
      const date = occurrenceDate(recurrence.dueDay, month);
      if (compareLocalDates(date, start) < 0 || compareLocalDates(date, today) > 0) continue;
      try {
        const before = await findOccurrenceTransaction(prisma, id, month);
        const row = await prisma.$transaction(
          (tx) => generateOccurrenceInTx(tx, today, id, month, { allowFuture: false }),
          TRANSACTION_OPTIONS,
        );
        if (row && !before) generated += 1;
      } catch (error) {
        console.error(`Falha ao gerar a ocorrência ${id}/${month}:`, error);
      }
    }
  }

  await prisma.$transaction(async (tx) => {
    await lockJob(tx, `occurrence-generation:${ctx.userId}`);
    const current = await tx.jobState.findUnique({ where: { key: markKey } });
    if (!current || compareLocalDates(current.value as LocalDate, today) < 0) {
      await tx.jobState.upsert({
        where: { key: markKey },
        create: { key: markKey, value: today },
        update: { value: today },
      });
    }
  }, TRANSACTION_OPTIONS);
  return generated;
};
