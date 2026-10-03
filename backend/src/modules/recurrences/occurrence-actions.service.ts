import type { LocalDate, YearMonth } from '../../shared/dates.js';
import {
  lockCard,
  lockPeriodsShared,
  lockRecurrence,
  TRANSACTION_OPTIONS,
} from '../../shared/db.js';
import type { AppContext } from '../../shared/context.js';
import { BusinessError } from '../../shared/errors.js';
import { loadClosedMonths } from '../financial-periods/periods.service.js';
import {
  toTransactionDto,
  type TransactionDto,
  type TransactionRow,
} from '../transactions/transaction-dto.js';
import {
  payTransactionInTx,
  updateTransactionInTx,
  type UpdateTransactionInput,
} from '../transactions/transactions.service.js';
import {
  evaluateOccurrence,
  findOccurrenceTransaction,
  generateOccurrenceInTx,
} from './occurrences.js';
import { findRecurrenceOrThrow } from './recurrence-store.js';

const notFound = (): BusinessError =>
  new BusinessError('RECURRENCE_OCCURRENCE_NOT_FOUND', 'Ocorrência não encontrada para o mês.');

const notSkippable = (message: string): BusinessError =>
  new BusinessError('RECURRENCE_OCCURRENCE_NOT_SKIPPABLE', message);

/** Ocorrência gerada ou, se projetada e elegível, gerada agora por interação do usuário. */
const materialize = async (
  ctx: AppContext,
  tx: Parameters<Parameters<AppContext['prisma']['$transaction']>[0]>[0],
  recurrenceId: string,
  month: YearMonth,
): Promise<TransactionRow> => {
  const row = await generateOccurrenceInTx(tx, ctx.clock.today(), recurrenceId, month, {
    allowFuture: true,
  });
  if (!row) throw notFound();
  return row;
};

/**
 * recurrences.md §9: edição individual (gera a ocorrência se projetada). Aplica a matriz de
 * edição de transactions.md §12; a categoria pertence à recorrência.
 */
export const editOccurrence = async (
  ctx: AppContext,
  recurrenceId: string,
  month: YearMonth,
  input: UpdateTransactionInput,
): Promise<TransactionDto> => {
  await findRecurrenceOrThrow(ctx.prisma, recurrenceId);
  const row = await ctx.prisma.$transaction(async (tx) => {
    const occurrence = await materialize(ctx, tx, recurrenceId, month);
    return updateTransactionInTx(tx, ctx.clock.today(), occurrence.id, input);
  }, TRANSACTION_OPTIONS);
  return toTransactionDto(row);
};

/** Pagar ocorrência com método comum (gera se projetada). Cartão é liquidado pela fatura. */
export const payOccurrence = async (
  ctx: AppContext,
  recurrenceId: string,
  month: YearMonth,
  paidAt: LocalDate,
): Promise<TransactionDto> => {
  await findRecurrenceOrThrow(ctx.prisma, recurrenceId);
  const row = await ctx.prisma.$transaction(async (tx) => {
    const occurrence = await materialize(ctx, tx, recurrenceId, month);
    return payTransactionInTx(tx, ctx.clock.today(), occurrence.id, paidAt);
  }, TRANSACTION_OPTIONS);
  return toTransactionDto(row);
};

/**
 * recurrences.md §10: pular cria uma `RecurrenceException`. Projetada → só a exceção. Gerada
 * com método comum e `PENDING` → remove o lançamento e cria a exceção na mesma transação.
 * Paga, de cartão ou de mês fechado → `RECURRENCE_OCCURRENCE_NOT_SKIPPABLE`.
 */
export const skipOccurrence = async (
  ctx: AppContext,
  recurrenceId: string,
  month: YearMonth,
): Promise<{ recurrence_id: string; occurrence_month: YearMonth; skipped: true }> => {
  await findRecurrenceOrThrow(ctx.prisma, recurrenceId);
  await ctx.prisma.$transaction(async (tx) => {
    await lockRecurrence(tx, recurrenceId);
    await lockPeriodsShared(tx);
    const closed = await loadClosedMonths(tx);

    const existingException = await tx.recurrenceException.findUnique({
      where: { recurrenceId_occurrenceMonth: { recurrenceId, occurrenceMonth: month } },
    });
    if (existingException) throw notSkippable('A ocorrência já foi pulada.');

    const occurrence = await findOccurrenceTransaction(tx, recurrenceId, month);
    if (occurrence) {
      if (occurrence.invoiceId) {
        throw notSkippable('Ocorrência de cartão é uma compra: use o estorno.');
      }
      if (occurrence.status === 'PAID') throw notSkippable('Ocorrência paga não pode ser pulada.');
      if (closed.has(occurrence.financialMonth as YearMonth)) {
        throw notSkippable('Ocorrência de mês fechado não pode ser pulada.');
      }
      await tx.transaction.delete({ where: { id: occurrence.id } });
    } else {
      const recurrence = await findRecurrenceOrThrow(tx, recurrenceId);
      const eligibility = await evaluateOccurrence(tx, recurrence, month, closed);
      if (!eligibility.eligible) {
        if (eligibility.reason === 'PERIOD_CLOSED') {
          throw notSkippable('Ocorrência de mês fechado não pode ser pulada.');
        }
        throw notFound();
      }
      const card = recurrence.paymentMethod.creditCard;
      if (card) await lockCard(tx, card.id);
    }
    await tx.recurrenceException.create({
      data: { recurrenceId, occurrenceMonth: month },
    });
  }, TRANSACTION_OPTIONS);
  return { recurrence_id: recurrenceId, occurrence_month: month, skipped: true };
};
