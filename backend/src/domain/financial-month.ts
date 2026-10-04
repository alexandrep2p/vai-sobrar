import { yearMonthOf, type LocalDate, type YearMonth } from '../shared/dates.js';

/** Item cujo mês financeiro é derivado diretamente (financial-periods.md §3). */
export type FinancialMonthBasis =
  | { kind: 'COMMON_TRANSACTION'; dueDate: LocalDate }
  | { kind: 'CARD_TRANSACTION'; invoiceReferenceMonth: YearMonth }
  | { kind: 'REFUND_ALLOCATION'; invoiceReferenceMonth: YearMonth };

/** Ocorrência projetada: usa a regra do item correspondente com a data/fatura projetadas. */
export interface ProjectedOccurrence {
  kind: 'PROJECTED_OCCURRENCE';
  projected: Extract<FinancialMonthBasis, { kind: 'COMMON_TRANSACTION' | 'CARD_TRANSACTION' }>;
}

export type FinancialMonthItem = FinancialMonthBasis | ProjectedOccurrence;

/**
 * financial-periods.md §3. `paid_at` não é parâmetro: nunca altera o mês financeiro.
 * Para cartão, o mês nunca é `mês(due_date)`.
 */
export const financialMonth = (item: FinancialMonthItem): YearMonth => {
  switch (item.kind) {
    case 'COMMON_TRANSACTION':
      return yearMonthOf(item.dueDate);
    case 'CARD_TRANSACTION':
    case 'REFUND_ALLOCATION':
      return item.invoiceReferenceMonth;
    case 'PROJECTED_OCCURRENCE':
      return financialMonth(item.projected);
  }
};
