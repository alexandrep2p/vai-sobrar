import type { Prisma } from '@prisma/client';
import type { LocalDate } from '../../shared/dates.js';
import { fromDbDate, fromDbDateOrNull, type Db } from '../../shared/db.js';
import { BusinessError } from '../../shared/errors.js';

export const transactionInclude = {
  category: true,
  paymentMethod: { include: { creditCard: true } },
  invoice: true,
  installment: { include: { installmentPlan: true } },
} satisfies Prisma.TransactionInclude;

export type TransactionRow = Prisma.TransactionGetPayload<{ include: typeof transactionInclude }>;

export interface TransactionDto {
  id: string;
  description: string;
  amount: number;
  type: 'INCOME' | 'EXPENSE';
  financial_month: string;
  due_date: LocalDate;
  paid_at: LocalDate | null;
  status: 'PENDING' | 'PAID';
  origin: 'MANUAL' | 'CREDIT_CARD' | 'INSTALLMENT' | 'RECURRENCE';
  category: { id: string; name: string; type: 'INCOME' | 'EXPENSE'; active: boolean };
  payment_method: { id: string; name: string; kind: 'STANDARD' | 'CREDIT_CARD'; active: boolean };
  credit_card_id: string | null;
  purchase_date: LocalDate | null;
  invoice: {
    id: string;
    reference_month: string;
    closing_date: LocalDate;
    due_date: LocalDate;
    status: 'OPEN' | 'CLOSED' | 'PAID';
  } | null;
  recurrence_id: string | null;
  occurrence_month: string | null;
  installment: { plan_id: string; number: number; installment_count: number } | null;
  created_at: string;
  updated_at: string;
}

export const toTransactionDto = (row: TransactionRow): TransactionDto => ({
  id: row.id,
  description: row.description,
  amount: row.amount,
  type: row.category.type,
  financial_month: row.financialMonth,
  due_date: fromDbDate(row.dueDate),
  paid_at: fromDbDateOrNull(row.paidAt),
  status: row.status,
  origin: row.origin,
  category: {
    id: row.category.id,
    name: row.category.name,
    type: row.category.type,
    active: row.category.active,
  },
  payment_method: {
    id: row.paymentMethod.id,
    name: row.paymentMethod.name,
    kind: row.paymentMethod.kind,
    active: row.paymentMethod.active,
  },
  credit_card_id: row.paymentMethod.creditCard?.id ?? null,
  purchase_date: fromDbDateOrNull(row.purchaseDate),
  invoice: row.invoice
    ? {
        id: row.invoice.id,
        reference_month: row.invoice.referenceMonth,
        closing_date: fromDbDate(row.invoice.closingDate),
        due_date: fromDbDate(row.invoice.dueDate),
        status: row.invoice.status,
      }
    : null,
  recurrence_id: row.recurrenceId,
  occurrence_month: row.occurrenceMonth,
  installment: row.installment
    ? {
        plan_id: row.installment.installmentPlanId,
        number: row.installment.number,
        installment_count: row.installment.installmentPlan.installmentCount,
      }
    : null,
  created_at: row.createdAt.toISOString(),
  updated_at: row.updatedAt.toISOString(),
});

export const findTransactionOrThrow = async (db: Db, id: string): Promise<TransactionRow> => {
  const row = await db.transaction.findUnique({ where: { id }, include: transactionInclude });
  if (!row) throw new BusinessError('TRANSACTION_NOT_FOUND', 'Lançamento não encontrado.');
  return row;
};
