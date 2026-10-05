import { BusinessError } from '../../shared/errors.js';
import type { Tx } from '../../shared/db.js';
import type { YearMonth } from '../../shared/dates.js';

/**
 * PD-38: apagar uma compra apaga junto os estornos dela e as alocações de crédito. Só é permitido
 * se nenhuma fatura que recebeu crédito estiver `PAID` ou em mês fechado. Devolve as faturas que
 * perderam crédito (para poda das que ficarem vazias).
 */
export const deleteRefundsOf = async (
  tx: Tx,
  closedMonths: ReadonlySet<YearMonth>,
  target: { transactionIds: readonly string[]; planId?: string },
): Promise<string[]> => {
  const refunds = await tx.refund.findMany({
    where: {
      OR: [
        { transactionId: { in: [...target.transactionIds] } },
        ...(target.planId ? [{ installmentPlanId: target.planId }] : []),
      ],
    },
    include: { allocations: { include: { invoice: true } } },
  });
  if (refunds.length === 0) return [];

  const invoiceIds = new Set<string>();
  for (const allocation of refunds.flatMap((r) => r.allocations)) {
    if (closedMonths.has(allocation.invoice.referenceMonth as YearMonth)) {
      throw new BusinessError('PERIOD_CLOSED', 'Um estorno desta compra está em mês fechado.');
    }
    if (allocation.invoice.status === 'PAID') {
      throw new BusinessError(
        'INVOICE_ALREADY_PAID',
        'Um estorno desta compra está em fatura paga.',
      );
    }
    invoiceIds.add(allocation.invoiceId);
  }

  const refundIds = refunds.map((r) => r.id);
  await tx.refundAllocation.deleteMany({ where: { refundId: { in: refundIds } } });
  await tx.refund.deleteMany({ where: { id: { in: refundIds } } });
  return [...invoiceIds];
};
