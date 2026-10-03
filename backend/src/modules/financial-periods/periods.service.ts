import type { FinancialPeriodStatus } from '@prisma/client';
import type { AppContext } from '../../shared/context.js';
import { lockPeriodsShared, type Db, type Tx } from '../../shared/db.js';
import { BusinessError } from '../../shared/errors.js';
import type { ClosedMonths } from '../../domain/types.js';
import type { YearMonth } from '../../shared/dates.js';

export interface PeriodDto {
  reference_month: YearMonth;
  status: FinancialPeriodStatus;
  closed_at: string | null;
}

/** Meses fechados (financial-periods.md §2): mês sem registro está `OPEN`. */
export const loadClosedMonths = async (db: Db): Promise<ClosedMonths> => {
  const rows = await db.financialPeriod.findMany({
    where: { status: 'CLOSED' },
    select: { referenceMonth: true },
  });
  return new Set(rows.map((row) => row.referenceMonth as YearMonth));
};

export const getPeriod = async (db: Db, month: YearMonth): Promise<PeriodDto> => {
  const period = await db.financialPeriod.findUnique({ where: { referenceMonth: month } });
  return {
    reference_month: month,
    status: period?.status ?? 'OPEN',
    closed_at: period?.closedAt?.toISOString() ?? null,
  };
};

export const getPeriodState = ({ prisma }: AppContext, month: YearMonth): Promise<PeriodDto> =>
  getPeriod(prisma, month);

/**
 * Guarda de escrita (architecture §16): toma o lock compartilhado de meses — que impede o
 * fechamento concorrente até o fim da transação — e rejeita (`PERIOD_CLOSED`) se algum dos
 * meses informados (origem e destino) estiver fechado. Retorna os meses fechados.
 */
export const guardMonthsOpen = async (
  tx: Tx,
  months: readonly YearMonth[],
): Promise<ClosedMonths> => {
  await lockPeriodsShared(tx);
  const closed = await loadClosedMonths(tx);
  for (const month of months) {
    if (closed.has(month)) {
      throw new BusinessError('PERIOD_CLOSED', `O mês ${month} está fechado.`, { month });
    }
  }
  return closed;
};
