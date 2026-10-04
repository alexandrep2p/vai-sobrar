import { canClose } from '../../domain/can-close.js';
import { yearMonthOf, type YearMonth } from '../../shared/dates.js';
import { lockPeriodsExclusive, TRANSACTION_OPTIONS } from '../../shared/db.js';
import type { AppContext } from '../../shared/context.js';
import { BusinessError } from '../../shared/errors.js';
import { projectOccurrences } from '../recurrences/occurrences.js';
import { getPeriod, loadClosedMonths, type PeriodDto } from './periods.service.js';

/**
 * financial-periods.md §4 / architecture §15: aplica `canClose` com os dados reais e persiste
 * `CLOSED` + `closed_at` em uma transação. O lock exclusivo de meses impede que escritas
 * (que tomam o lock compartilhado) se intercalem com o fechamento. Não existe reabertura.
 */
export const closeMonth = async (ctx: AppContext, month: YearMonth): Promise<PeriodDto> => {
  const today = ctx.clock.today();
  return ctx.prisma.$transaction(async (tx) => {
    await lockPeriodsExclusive(tx);
    const closedMonths = await loadClosedMonths(tx);

    const [pending, projected, unpaidInvoices, months] = await Promise.all([
      tx.transaction.count({ where: { financialMonth: month, status: 'PENDING' } }),
      projectOccurrences(tx, today, month),
      tx.invoice.count({ where: { referenceMonth: month, status: { not: 'PAID' } } }),
      tx.transaction.findMany({ distinct: ['financialMonth'], select: { financialMonth: true } }),
    ]);

    const verdict = canClose({
      month,
      currentMonth: yearMonthOf(today),
      closedMonths,
      pendingTransactionCount: pending,
      projectedOccurrenceCount: projected.length,
      unpaidInvoiceCount: unpaidInvoices,
      monthsWithTransactions: new Set(months.map((m) => m.financialMonth as YearMonth)),
    });
    if (!verdict.canClose) {
      throw new BusinessError(verdict.code, `O mês ${month} não pode ser fechado.`, {
        month,
        pending_transactions: pending,
        projected_occurrences: projected.length,
        unpaid_invoices: unpaidInvoices,
      });
    }

    await tx.financialPeriod.upsert({
      where: { referenceMonth: month },
      create: { referenceMonth: month, status: 'CLOSED', closedAt: new Date() },
      update: { status: 'CLOSED', closedAt: new Date() },
    });
    return getPeriod(tx, month);
  }, TRANSACTION_OPTIONS);
};
