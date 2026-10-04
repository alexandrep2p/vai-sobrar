import type {
  CategoryType,
  FinancialPeriodStatus,
  InvoiceStatus,
  PaymentMethodKind,
  PaymentMethodSource,
  RecurrenceStatus,
  RefundStrategy,
  TransactionOrigin,
  TransactionStatus,
} from '../../shared/labels/labels';

/** Tipos dos contratos da API (espelham os DTOs do backend). Valores em centavos; datas "YYYY-MM-DD". */

export interface ListResponse<T> {
  data: T[];
}

export interface Category {
  id: string;
  name: string;
  type: CategoryType;
  active: boolean;
  in_use: boolean;
}

export interface PaymentMethod {
  id: string;
  name: string;
  source: PaymentMethodSource;
  kind: PaymentMethodKind;
  active: boolean;
}

export interface CreditCard {
  id: string;
  payment_method_id: string;
  name: string;
  active: boolean;
  best_purchase_day: number;
  due_day: number;
}

export interface CardInput {
  name: string;
  best_purchase_day: number;
  due_day: number;
}

export interface Period {
  reference_month: string;
  status: FinancialPeriodStatus;
  closed_at: string | null;
}

export interface Ref {
  id: string;
  name: string;
}

export interface StatementItem {
  item_type: 'TRANSACTION' | 'PROJECTED_OCCURRENCE' | 'REFUND_CREDIT';
  display_date: string;
  description: string;
  amount: number;
  signed_amount: number;
  nature: CategoryType;
  status: TransactionStatus | null;
  transaction_id: string | null;
  origin: TransactionOrigin | null;
  category: Ref;
  payment_method: Ref;
  credit_card: Ref | null;
  invoice: {
    id: string | null;
    reference_month: string;
    due_date: string;
    status: InvoiceStatus | null;
  } | null;
  purchase_date: string | null;
  due_date: string | null;
  installment: { number: number; installment_count: number; installment_plan_id: string } | null;
  recurrence_id: string | null;
  occurrence_month: string | null;
  refund: { refund_id: string; original_transaction_id: string } | null;
}

export interface MonthlyStatement {
  month: Period;
  totals: { incomes: number; expenses: number; balance: number };
  items: StatementItem[];
}

export interface Transaction {
  id: string;
  description: string;
  amount: number;
  type: CategoryType;
  financial_month: string;
  due_date: string;
  paid_at: string | null;
  status: TransactionStatus;
  origin: TransactionOrigin;
  category: { id: string; name: string; type: CategoryType; active: boolean };
  payment_method: { id: string; name: string; kind: PaymentMethodKind; active: boolean };
  credit_card_id: string | null;
  purchase_date: string | null;
  invoice: {
    id: string;
    reference_month: string;
    closing_date: string;
    due_date: string;
    status: InvoiceStatus;
  } | null;
  recurrence_id: string | null;
  occurrence_month: string | null;
  installment: { plan_id: string; number: number; installment_count: number } | null;
}

export interface TransactionInput {
  description: string;
  amount: number;
  category_id: string;
  payment_method_id: string;
  due_date?: string;
  purchase_date?: string;
  installment_count?: number;
}

export interface TransactionUpdate {
  description?: string;
  amount?: number;
  due_date?: string;
  category_id?: string;
  payment_method_id?: string;
}

export interface InstallmentPlan {
  id: string;
  credit_card_id: string;
  description: string;
  category: { id: string; name: string; type: CategoryType };
  total_amount: number;
  installment_count: number;
  purchase_date: string;
  installments: {
    number: number;
    transaction_id: string;
    amount: number;
    status: TransactionStatus;
    financial_month: string;
    due_date: string;
    invoice: { id: string; reference_month: string; status: InvoiceStatus } | null;
  }[];
}

export type InvoiceSituation = 'OVERDUE' | null;

export interface InvoiceSummary {
  id: string | null;
  credit_card_id: string;
  reference_month: string;
  closing_date: string;
  due_date: string;
  status: InvoiceStatus;
  situation: InvoiceSituation;
  persisted: boolean;
  paid_at: string | null;
  payment_method_id: string | null;
  credit_balance: number;
  totals: {
    debits: number;
    credits: number;
    received_credit: number;
    amount_due: number;
    credit_balance: number;
  };
}

export interface InvoiceDetail extends InvoiceSummary {
  card_name: string;
  transactions: Transaction[];
  credits: {
    allocation_id: string;
    refund_id: string;
    refund_date: string;
    transaction_id: string;
    description: string;
    amount: number;
  }[];
  received_credits: { invoice_id: string; reference_month: string; amount: number }[];
}

export type RefundSituation = 'FULLY_REFUNDED' | 'PARTIALLY_REFUNDED' | null;

export interface RefundSummary {
  original_amount: number;
  refunded_amount: number;
  refundable_amount: number;
  refund_status: RefundSituation;
}

export interface RefundInput {
  transaction_id?: string;
  installment_plan_id?: string;
  amount: number;
  refund_date: string;
  strategy?: RefundStrategy;
}

export interface Recurrence {
  id: string;
  description: string;
  amount: number;
  type: CategoryType;
  category: { id: string; name: string; type: CategoryType; active: boolean };
  payment_method: { id: string; name: string; kind: PaymentMethodKind; active: boolean };
  due_day: number;
  start_date: string;
  end_date: string | null;
  status: RecurrenceStatus;
  paused_from: string | null;
  paused_until: string | null;
  cancelled_at: string | null;
}

export interface RecurrenceInput {
  description: string;
  amount: number;
  category_id: string;
  payment_method_id: string;
  due_day: number;
  start_date?: string;
  end_date?: string | null;
}

export interface OccurrenceUpdate {
  description?: string;
  amount?: number;
  due_date?: string;
  payment_method_id?: string;
}
