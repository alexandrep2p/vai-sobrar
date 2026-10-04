import { compareLocalDates, type LocalDate, type YearMonth } from '../../shared/dates.js';
import { fromDbDate, fromDbDateOrNull } from '../../shared/db.js';
import type { AppContext } from '../../shared/context.js';
import { getPeriod, type PeriodDto } from '../financial-periods/periods.service.js';
import { projectOccurrences } from '../recurrences/occurrences.js';
import { transactionInclude } from '../transactions/transaction-dto.js';

type Nature = 'INCOME' | 'EXPENSE';

export interface StatementItem {
  /** `TRANSACTION`, `PROJECTED_OCCURRENCE` ou `REFUND_CREDIT` (architecture §10). */
  item_type: 'TRANSACTION' | 'PROJECTED_OCCURRENCE' | 'REFUND_CREDIT';
  /** `due_date` (método comum), `purchase_date` (cartão) ou `refund_date` (crédito) — home.md §3.1. */
  display_date: LocalDate;
  description: string;
  /** Valor em centavos, sempre positivo. */
  amount: number;
  /** Valor com sinal para exibição: entradas e créditos de saída são positivos. */
  signed_amount: number;
  nature: Nature;
  /** Créditos de estorno não têm status. */
  status: 'PENDING' | 'PAID' | null;
  transaction_id: string | null;
  origin: 'MANUAL' | 'CREDIT_CARD' | 'INSTALLMENT' | 'RECURRENCE' | null;
  category: { id: string; name: string };
  payment_method: { id: string; name: string };
  credit_card: { id: string; name: string } | null;
  invoice: {
    id: string | null;
    reference_month: string;
    due_date: LocalDate;
    status: 'OPEN' | 'CLOSED' | 'PAID' | null;
  } | null;
  purchase_date: LocalDate | null;
  due_date: LocalDate | null;
  installment: { number: number; installment_count: number; installment_plan_id: string } | null;
  recurrence_id: string | null;
  occurrence_month: string | null;
  refund: { refund_id: string; original_transaction_id: string } | null;
}

export interface MonthlyStatementDto {
  month: PeriodDto;
  totals: { incomes: number; expenses: number; balance: number };
  items: StatementItem[];
}

const SORT_RANK: Record<StatementItem['item_type'], number> = {
  TRANSACTION: 0,
  PROJECTED_OCCURRENCE: 1,
  REFUND_CREDIT: 2,
};

/**
 * home.md / architecture §10: itens do mês financeiro (lançamentos, ocorrências projetadas e créditos
 * de estorno reconhecidos em faturas do mês), totais com estornos abatidos pela natureza da compra
 * original, e saldo previsto. O status não altera os totais.
 */
export const getMonthlyStatement = async (
  { prisma, clock }: AppContext,
  month: YearMonth,
): Promise<MonthlyStatementDto> => {
  const today = clock.today();
  const [period, transactions, allocations, projected] = await Promise.all([
    getPeriod(prisma, month),
    prisma.transaction.findMany({
      where: { financialMonth: month },
      include: transactionInclude,
      orderBy: { createdAt: 'asc' },
    }),
    prisma.refundAllocation.findMany({
      where: { invoice: { referenceMonth: month } },
      include: {
        refund: true,
        invoice: true,
        transaction: { include: transactionInclude },
      },
      orderBy: { createdAt: 'asc' },
    }),
    projectOccurrences(prisma, today, month),
  ]);

  const items: StatementItem[] = [];

  for (const t of transactions) {
    const card = t.paymentMethod.creditCard;
    const cardPosted = t.invoiceId !== null;
    const nature = t.category.type;
    items.push({
      item_type: 'TRANSACTION',
      display_date: cardPosted ? fromDbDate(t.purchaseDate as Date) : fromDbDate(t.dueDate),
      description: t.description,
      amount: t.amount,
      signed_amount: nature === 'INCOME' ? t.amount : -t.amount,
      nature,
      status: t.status,
      transaction_id: t.id,
      origin: t.origin,
      category: { id: t.category.id, name: t.category.name },
      payment_method: { id: t.paymentMethod.id, name: t.paymentMethod.name },
      credit_card: card ? { id: card.id, name: t.paymentMethod.name } : null,
      invoice: t.invoice
        ? {
            id: t.invoice.id,
            reference_month: t.invoice.referenceMonth,
            due_date: fromDbDate(t.invoice.dueDate),
            status: t.invoice.status,
          }
        : null,
      purchase_date: fromDbDateOrNull(t.purchaseDate),
      due_date: fromDbDate(t.dueDate),
      installment: t.installment
        ? {
            number: t.installment.number,
            installment_count: t.installment.installmentPlan.installmentCount,
            installment_plan_id: t.installment.installmentPlanId,
          }
        : null,
      recurrence_id: t.recurrenceId,
      occurrence_month: t.occurrenceMonth,
      refund: null,
    });
  }

  for (const p of projected) {
    const r = p.recurrence;
    const card = r.paymentMethod.creditCard;
    const nature = r.category.type;
    items.push({
      item_type: 'PROJECTED_OCCURRENCE',
      display_date: p.date,
      description: r.description,
      amount: r.amount,
      signed_amount: nature === 'INCOME' ? r.amount : -r.amount,
      nature,
      status: 'PENDING',
      transaction_id: null,
      origin: 'RECURRENCE',
      category: { id: r.category.id, name: r.category.name },
      payment_method: { id: r.paymentMethod.id, name: r.paymentMethod.name },
      credit_card: card ? { id: card.id, name: r.paymentMethod.name } : null,
      invoice: p.invoice
        ? {
            id: p.invoice.id,
            reference_month: p.invoice.referenceMonth,
            due_date: p.invoice.dueDate,
            status: null,
          }
        : null,
      purchase_date: card ? p.date : null,
      due_date: p.dueDate,
      installment: null,
      recurrence_id: r.id,
      occurrence_month: p.occurrenceMonth,
      refund: null,
    });
  }

  for (const a of allocations) {
    const original = a.transaction;
    const nature = original.category.type;
    items.push({
      item_type: 'REFUND_CREDIT',
      display_date: fromDbDate(a.refund.refundDate),
      description: `Estorno — ${original.description}`,
      amount: a.amount,
      // O crédito reduz a natureza da compra original (refunds.md §9).
      signed_amount: nature === 'EXPENSE' ? a.amount : -a.amount,
      nature,
      status: null,
      transaction_id: original.id,
      origin: original.origin,
      category: { id: original.category.id, name: original.category.name },
      payment_method: { id: original.paymentMethod.id, name: original.paymentMethod.name },
      credit_card: original.paymentMethod.creditCard
        ? { id: original.paymentMethod.creditCard.id, name: original.paymentMethod.name }
        : null,
      invoice: {
        id: a.invoice.id,
        reference_month: a.invoice.referenceMonth,
        due_date: fromDbDate(a.invoice.dueDate),
        status: a.invoice.status,
      },
      purchase_date: fromDbDateOrNull(original.purchaseDate),
      due_date: null,
      installment: original.installment
        ? {
            number: original.installment.number,
            installment_count: original.installment.installmentPlan.installmentCount,
            installment_plan_id: original.installment.installmentPlanId,
          }
        : null,
      recurrence_id: original.recurrenceId,
      occurrence_month: original.occurrenceMonth,
      refund: { refund_id: a.refundId, original_transaction_id: original.id },
    });
  }

  items.sort(
    (a, b) =>
      compareLocalDates(a.display_date, b.display_date) ||
      SORT_RANK[a.item_type] - SORT_RANK[b.item_type],
  );

  // Entradas/saídas previstas: todos os itens, pendentes ou pagos; créditos abatem a natureza da compra.
  let incomes = 0;
  let expenses = 0;
  for (const item of items) {
    if (item.item_type === 'REFUND_CREDIT') {
      if (item.nature === 'EXPENSE') expenses -= item.amount;
      else incomes -= item.amount;
    } else if (item.nature === 'INCOME') {
      incomes += item.amount;
    } else {
      expenses += item.amount;
    }
  }

  return { month: period, totals: { incomes, expenses, balance: incomes - expenses }, items };
};
