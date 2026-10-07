import type { Prisma } from '@prisma/client';
import { compareLocalDates, type LocalDate } from '../../shared/dates.js';
import { fromDbDate, toDbDate, TRANSACTION_OPTIONS, type Db } from '../../shared/db.js';
import type { AppContext } from '../../shared/context.js';
import { BusinessError } from '../../shared/errors.js';
import { loadActiveCategory, loadActiveMethod } from '../transactions/transactions.service.js';
import { generateDueOccurrences } from './occurrences.js';
import {
  findRecurrenceOrThrow,
  recurrenceInclude,
  toRecurrenceDto,
  type RecurrenceDto,
} from './recurrence-store.js';

/**
 * recurrences.md §11: `PAUSED` enquanto a pausa estiver vigente; volta a `ACTIVE` ao atingir
 * `paused_until`. Idempotente e determinístico (mesmo mecanismo das faturas — T-23).
 */
export const syncRecurrencePauses = async (db: Db, today: LocalDate): Promise<void> => {
  const date = toDbDate(today);
  await db.recurrence.updateMany({
    where: {
      status: 'ACTIVE',
      pausedFrom: { lte: date },
      OR: [{ pausedUntil: null }, { pausedUntil: { gt: date } }],
    },
    data: { status: 'PAUSED' },
  });
  await db.recurrence.updateMany({
    where: { status: 'PAUSED', pausedUntil: { lte: date } },
    data: { status: 'ACTIVE' },
  });
};

const assertNotCancelled = (status: string): void => {
  if (status === 'CANCELLED') {
    throw new BusinessError('RECURRENCE_CANCELLED', 'A recorrência foi cancelada.');
  }
};

export const listRecurrences = async ({ prisma }: AppContext): Promise<RecurrenceDto[]> => {
  const rows = await prisma.recurrence.findMany({
    include: recurrenceInclude,
    orderBy: [{ createdAt: 'asc' }],
  });
  return rows.map(toRecurrenceDto);
};

export const getRecurrence = async ({ prisma }: AppContext, id: string): Promise<RecurrenceDto> =>
  toRecurrenceDto(await findRecurrenceOrThrow(prisma, id));

export interface CreateRecurrenceInput {
  description: string;
  amount: number;
  categoryId: string;
  paymentMethodId: string;
  dueDay: number;
  startDate: LocalDate;
  endDate?: LocalDate | undefined;
}

export const createRecurrence = async (
  ctx: AppContext,
  input: CreateRecurrenceInput,
): Promise<RecurrenceDto> => {
  const category = await loadActiveCategory(ctx.prisma, input.categoryId);
  const method = await loadActiveMethod(ctx.prisma, input.paymentMethodId);
  const created = await ctx.prisma.recurrence.create({
    data: {
      userId: ctx.userId,
      description: input.description,
      amount: input.amount,
      categoryId: category.id,
      paymentMethodId: method.id,
      dueDay: input.dueDay,
      startDate: toDbDate(input.startDate),
      endDate: input.endDate ? toDbDate(input.endDate) : null,
      status: 'ACTIVE',
      createdOn: toDbDate(ctx.clock.today()),
    },
  });
  // Se a data da ocorrência de hoje já chegou, ela é gerada agora (data ≥ criação).
  await generateDueOccurrences(ctx, { fromToday: true });
  return toRecurrenceDto(await findRecurrenceOrThrow(ctx.prisma, created.id));
};

export interface UpdateRecurrenceInput {
  description?: string | undefined;
  amount?: number | undefined;
  categoryId?: string | undefined;
  paymentMethodId?: string | undefined;
  dueDay?: number | undefined;
  /** `null` remove a data de término. */
  endDate?: LocalDate | null | undefined;
}

/** recurrences.md §8: vale para ocorrências ainda não geradas; geradas nunca mudam. */
export const updateRecurrence = async (
  ctx: AppContext,
  id: string,
  input: UpdateRecurrenceInput,
): Promise<RecurrenceDto> => {
  const current = await findRecurrenceOrThrow(ctx.prisma, id);
  assertNotCancelled(current.status);

  const data: Prisma.RecurrenceUncheckedUpdateInput = {};
  if (input.description !== undefined) data.description = input.description;
  if (input.amount !== undefined) data.amount = input.amount;
  if (input.dueDay !== undefined) data.dueDay = input.dueDay;
  if (input.categoryId !== undefined && input.categoryId !== current.categoryId) {
    data.categoryId = (await loadActiveCategory(ctx.prisma, input.categoryId)).id;
  }
  if (input.paymentMethodId !== undefined && input.paymentMethodId !== current.paymentMethodId) {
    data.paymentMethodId = (await loadActiveMethod(ctx.prisma, input.paymentMethodId)).id;
  }
  if (input.endDate !== undefined) {
    data.endDate = input.endDate === null ? null : toDbDate(input.endDate);
  }
  await ctx.prisma.recurrence.update({ where: { id }, data });
  return toRecurrenceDto(await findRecurrenceOrThrow(ctx.prisma, id));
};

/** recurrences.md §11: `paused_from` hoje ou futuro; retorno (`paused_until`) opcional e posterior. */
export const pauseRecurrence = async (
  ctx: AppContext,
  id: string,
  input: { pausedFrom: LocalDate; pausedUntil?: LocalDate | undefined },
): Promise<RecurrenceDto> => {
  const today = ctx.clock.today();
  const current = await findRecurrenceOrThrow(ctx.prisma, id);
  assertNotCancelled(current.status);
  if (current.status !== 'ACTIVE') {
    throw new BusinessError(
      'RECURRENCE_INVALID_STATE',
      'Só uma recorrência ativa pode ser pausada.',
    );
  }
  if (compareLocalDates(input.pausedFrom, today) < 0) {
    throw new BusinessError(
      'INVALID_PAUSE_PERIOD',
      'O início da pausa deve ser hoje ou uma data futura.',
    );
  }
  if (input.pausedUntil && compareLocalDates(input.pausedUntil, input.pausedFrom) <= 0) {
    throw new BusinessError(
      'INVALID_PAUSE_PERIOD',
      'O retorno deve ser posterior ao início da pausa.',
    );
  }
  await ctx.prisma.recurrence.update({
    where: { id },
    data: {
      pausedFrom: toDbDate(input.pausedFrom),
      pausedUntil: input.pausedUntil ? toDbDate(input.pausedUntil) : null,
    },
  });
  await syncRecurrencePauses(ctx.prisma, today);
  return toRecurrenceDto(await findRecurrenceOrThrow(ctx.prisma, id));
};

/**
 * Retomar: encerra a pausa vigente hoje (sem ocorrências retroativas: as datas da pausa já
 * passadas continuam bloqueadas) ou cancela uma pausa ainda agendada.
 */
export const resumeRecurrence = async (ctx: AppContext, id: string): Promise<RecurrenceDto> => {
  const today = ctx.clock.today();
  const current = await findRecurrenceOrThrow(ctx.prisma, id);
  assertNotCancelled(current.status);

  if (current.status === 'PAUSED') {
    await ctx.prisma.recurrence.update({
      where: { id },
      data: { status: 'ACTIVE', pausedUntil: toDbDate(today) },
    });
    await generateDueOccurrences(ctx, { fromToday: true });
  } else if (current.pausedFrom && compareLocalDates(fromDbDate(current.pausedFrom), today) > 0) {
    await ctx.prisma.recurrence.update({
      where: { id },
      data: { pausedFrom: null, pausedUntil: null },
    });
  } else {
    throw new BusinessError('RECURRENCE_INVALID_STATE', 'A recorrência não está pausada.');
  }
  return toRecurrenceDto(await findRecurrenceOrThrow(ctx.prisma, id));
};

/** Cancelamento definitivo: nada com data igual ou posterior é gerado (CD-22); geradas permanecem. */
export const cancelRecurrence = async (ctx: AppContext, id: string): Promise<RecurrenceDto> => {
  const current = await findRecurrenceOrThrow(ctx.prisma, id);
  assertNotCancelled(current.status);
  await ctx.prisma.$transaction(
    (tx) =>
      tx.recurrence.update({
        where: { id },
        data: { status: 'CANCELLED', cancelledAt: toDbDate(ctx.clock.today()) },
      }),
    TRANSACTION_OPTIONS,
  );
  return toRecurrenceDto(await findRecurrenceOrThrow(ctx.prisma, id));
};
