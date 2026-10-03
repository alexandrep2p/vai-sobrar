import type { Prisma } from '@prisma/client';
import type { RecurrenceRule } from '../../domain/recurrence-eligibility.js';
import type { LocalDate } from '../../shared/dates.js';
import { fromDbDate, fromDbDateOrNull, type Db } from '../../shared/db.js';
import { BusinessError } from '../../shared/errors.js';

export const recurrenceInclude = {
  category: true,
  paymentMethod: { include: { creditCard: true } },
} satisfies Prisma.RecurrenceInclude;

export type RecurrenceRow = Prisma.RecurrenceGetPayload<{ include: typeof recurrenceInclude }>;

export interface RecurrenceDto {
  id: string;
  description: string;
  amount: number;
  type: 'INCOME' | 'EXPENSE';
  category: { id: string; name: string; type: 'INCOME' | 'EXPENSE'; active: boolean };
  payment_method: { id: string; name: string; kind: 'STANDARD' | 'CREDIT_CARD'; active: boolean };
  due_day: number;
  start_date: LocalDate;
  end_date: LocalDate | null;
  status: 'ACTIVE' | 'PAUSED' | 'CANCELLED';
  paused_from: LocalDate | null;
  paused_until: LocalDate | null;
  cancelled_at: LocalDate | null;
  created_at: string;
  updated_at: string;
}

export const toRecurrenceDto = (r: RecurrenceRow): RecurrenceDto => ({
  id: r.id,
  description: r.description,
  amount: r.amount,
  type: r.category.type,
  category: {
    id: r.category.id,
    name: r.category.name,
    type: r.category.type,
    active: r.category.active,
  },
  payment_method: {
    id: r.paymentMethod.id,
    name: r.paymentMethod.name,
    kind: r.paymentMethod.kind,
    active: r.paymentMethod.active,
  },
  due_day: r.dueDay,
  start_date: fromDbDate(r.startDate),
  end_date: fromDbDateOrNull(r.endDate),
  status: r.status,
  paused_from: fromDbDateOrNull(r.pausedFrom),
  paused_until: fromDbDateOrNull(r.pausedUntil),
  cancelled_at: fromDbDateOrNull(r.cancelledAt),
  created_at: r.createdAt.toISOString(),
  updated_at: r.updatedAt.toISOString(),
});

export const toRule = (r: RecurrenceRow): RecurrenceRule => ({
  dueDay: r.dueDay,
  startDate: fromDbDate(r.startDate),
  createdOn: fromDbDate(r.createdOn),
  endDate: fromDbDateOrNull(r.endDate) ?? undefined,
  status: r.status,
  cancelledOn: fromDbDateOrNull(r.cancelledAt) ?? undefined,
  pausedFrom: fromDbDateOrNull(r.pausedFrom) ?? undefined,
  pausedUntil: fromDbDateOrNull(r.pausedUntil) ?? undefined,
});

export const findRecurrenceOrThrow = async (db: Db, id: string): Promise<RecurrenceRow> => {
  const recurrence = await db.recurrence.findUnique({ where: { id }, include: recurrenceInclude });
  if (!recurrence) throw new BusinessError('RECURRENCE_NOT_FOUND', 'Recorrência não encontrada.');
  return recurrence;
};
