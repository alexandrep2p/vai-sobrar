import type { LocalDate, YearMonth } from '../shared/dates.js';

export type InvoiceStatus = 'OPEN' | 'CLOSED' | 'PAID';

/** Configuração de faturamento do cartão (credit-cards.md §3.1). */
export interface CardConfig {
  /** 1..31 */
  bestPurchaseDay: number;
  /** 1..31 */
  dueDay: number;
}

/** Fatura persistida, como dado de entrada das funções de domínio. */
export interface InvoiceSnapshot {
  referenceMonth: YearMonth;
  closingDate: LocalDate;
  dueDate: LocalDate;
  status: InvoiceStatus;
}

/** Meses financeiros fechados (financial-periods.md). Meses ausentes estão abertos. */
export type ClosedMonths = ReadonlySet<YearMonth>;

/** Fatura que ainda não existe e deve ser criada pelo caso de uso. */
export interface InvoiceToCreate {
  referenceMonth: YearMonth;
  closingDate: LocalDate;
  dueDate: LocalDate;
  status: InvoiceStatus;
}

/** Resultado de escolha de fatura: uma existente ou uma a criar. */
export type InvoiceChoice =
  | { needsCreation: false; invoice: InvoiceSnapshot }
  | { needsCreation: true; invoice: InvoiceToCreate };
