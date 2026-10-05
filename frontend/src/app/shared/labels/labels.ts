// Labels da UI para os enums de domain-model §5 e situações derivadas.
const CATEGORY_TYPE = { INCOME: 'Entrada', EXPENSE: 'Saída' } as const;
const PAYMENT_METHOD_SOURCE = { SYSTEM: 'Sistema', USER: 'Personalizado' } as const;
const PAYMENT_METHOD_KIND = { STANDARD: 'Comum', CREDIT_CARD: 'Cartão de crédito' } as const;
const TRANSACTION_STATUS = { PENDING: 'Em aberto', PAID: 'Pago' } as const;
const TRANSACTION_ORIGIN = {
  MANUAL: 'Manual',
  CREDIT_CARD: 'Compra no cartão',
  INSTALLMENT: 'Parcela',
  RECURRENCE: 'Recorrência',
} as const;
const FINANCIAL_PERIOD_STATUS = { OPEN: 'Aberto', CLOSED: 'Fechado' } as const;
const INVOICE_STATUS = { OPEN: 'Aberta', CLOSED: 'Fechada', PAID: 'Paga' } as const;
const RECURRENCE_STATUS = { ACTIVE: 'Ativa', PAUSED: 'Pausada', CANCELLED: 'Cancelada' } as const;
const REFUND_STRATEGY = {
  FIRST_INSTALLMENTS: 'Primeiras parcelas',
  LAST_INSTALLMENTS: 'Últimas parcelas',
  PROPORTIONAL: 'Proporcional',
} as const;

export type CategoryType = keyof typeof CATEGORY_TYPE;
export type PaymentMethodSource = keyof typeof PAYMENT_METHOD_SOURCE;
export type PaymentMethodKind = keyof typeof PAYMENT_METHOD_KIND;
export type TransactionStatus = keyof typeof TRANSACTION_STATUS;
export type TransactionOrigin = keyof typeof TRANSACTION_ORIGIN;
export type FinancialPeriodStatus = keyof typeof FINANCIAL_PERIOD_STATUS;
export type InvoiceStatus = keyof typeof INVOICE_STATUS;
export type RecurrenceStatus = keyof typeof RECURRENCE_STATUS;
export type RefundStrategy = keyof typeof REFUND_STRATEGY;

export const categoryTypeLabel = (v: CategoryType): string => CATEGORY_TYPE[v];
export const paymentMethodSourceLabel = (v: PaymentMethodSource): string =>
  PAYMENT_METHOD_SOURCE[v];
export const paymentMethodKindLabel = (v: PaymentMethodKind): string => PAYMENT_METHOD_KIND[v];
export const transactionStatusLabel = (v: TransactionStatus): string => TRANSACTION_STATUS[v];
export const transactionOriginLabel = (v: TransactionOrigin): string => TRANSACTION_ORIGIN[v];
export const financialPeriodStatusLabel = (v: FinancialPeriodStatus): string =>
  FINANCIAL_PERIOD_STATUS[v];
export const invoiceStatusLabel = (v: InvoiceStatus): string => INVOICE_STATUS[v];
export const recurrenceStatusLabel = (v: RecurrenceStatus): string => RECURRENCE_STATUS[v];
export const refundStrategyLabel = (v: RefundStrategy): string => REFUND_STRATEGY[v];

/** Estado ativo/inativo: categoria "Ativa/Inativa"; método "Ativo/Inativo" (domain-model §5). */
export const activeLabel = (active: boolean, gender: 'f' | 'm' = 'f'): string =>
  gender === 'f' ? (active ? 'Ativa' : 'Inativa') : active ? 'Ativo' : 'Inativo';

// Situações derivadas (não persistidas).
export const OVERDUE_INVOICE_LABEL = 'Atrasada';
export const PROJECTED_ITEM_LABEL = 'Previsto';
export const NO_ENTRIES_CYCLE_LABEL = 'Sem lançamentos';
export const REFUNDED_LABEL = 'Estornada';
export const PARTIALLY_REFUNDED_LABEL = 'Parcialmente estornada';
export const SKIPPED_OCCURRENCE_LABEL = 'Pulada';
export const LATE_PURCHASE_LABEL = 'Compra de ciclo anterior';
