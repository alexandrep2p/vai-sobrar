export const BUSINESS_ERROR_CODES = [
  'PERIOD_CLOSED',
  'PERIOD_HAS_PENDING_TRANSACTIONS',
  'PERIOD_HAS_UNPAID_INVOICES',
  'PERIOD_PREVIOUS_NOT_CLOSED',
  'PERIOD_FUTURE_NOT_CLOSABLE',
  'TRANSACTION_NOT_FOUND',
  'TRANSACTION_NOT_EDITABLE',
  'TRANSACTION_NOT_DELETABLE',
  'CATEGORY_INACTIVE',
  'CATEGORY_TYPE_MISMATCH',
  'CATEGORY_TYPE_LOCKED',
  'PAYMENT_METHOD_INACTIVE',
  'PAYMENT_METHOD_NOT_EDITABLE',
  'CARD_INACTIVE',
  'INVOICE_NOT_CLOSED',
  'INVOICE_ALREADY_PAID',
  'INVOICE_PAYMENT_METHOD_INVALID',
  'INVOICE_NOT_OPEN_FOR_CREDIT',
  'CARD_TRANSACTION_SETTLED_BY_INVOICE',
  'INVALID_PAYMENT_DATE',
  'INVALID_PURCHASE_DATE',
  'INVALID_INSTALLMENT_OPERATION',
  'REFUND_TARGET_NOT_ALLOWED',
  'REFUND_EXCEEDS_REMAINING_AMOUNT',
  'INVALID_REFUND_DATE',
  'RECURRENCE_OCCURRENCE_NOT_SKIPPABLE',
  'RECURRENCE_CANCELLED',
  // Códigos técnicos adicionais (a lista da architecture §23 é refinável)
  'CATEGORY_NOT_FOUND',
  'CATEGORY_NAME_TAKEN',
  'PAYMENT_METHOD_NOT_FOUND',
  'PAYMENT_METHOD_NAME_TAKEN',
  'CARD_NOT_FOUND',
  'INVOICE_NOT_FOUND',
  'INSTALLMENT_PLAN_NOT_FOUND',
  'REFUND_NOT_FOUND',
  'RECURRENCE_NOT_FOUND',
  'RECURRENCE_OCCURRENCE_NOT_FOUND',
  'RECURRENCE_INVALID_STATE',
  'INVALID_DUE_DATE',
  'INVALID_PAUSE_PERIOD',
] as const;

export type BusinessErrorCode = (typeof BUSINESS_ERROR_CODES)[number];

// Mapeamento técnico código -> status HTTP: 404 não encontrado, 409 conflito com o estado
// atual, 422 demais violações de regra.
const NOT_FOUND: ReadonlySet<BusinessErrorCode> = new Set([
  'TRANSACTION_NOT_FOUND',
  'CATEGORY_NOT_FOUND',
  'PAYMENT_METHOD_NOT_FOUND',
  'CARD_NOT_FOUND',
  'INVOICE_NOT_FOUND',
  'INSTALLMENT_PLAN_NOT_FOUND',
  'REFUND_NOT_FOUND',
  'RECURRENCE_NOT_FOUND',
  'RECURRENCE_OCCURRENCE_NOT_FOUND',
]);
const CONFLICT: ReadonlySet<BusinessErrorCode> = new Set([
  'PERIOD_CLOSED',
  'PERIOD_HAS_PENDING_TRANSACTIONS',
  'PERIOD_HAS_UNPAID_INVOICES',
  'PERIOD_PREVIOUS_NOT_CLOSED',
  'PERIOD_FUTURE_NOT_CLOSABLE',
  'TRANSACTION_NOT_EDITABLE',
  'TRANSACTION_NOT_DELETABLE',
  'CATEGORY_TYPE_LOCKED',
  'PAYMENT_METHOD_NOT_EDITABLE',
  'INVOICE_NOT_CLOSED',
  'INVOICE_ALREADY_PAID',
  'INVOICE_NOT_OPEN_FOR_CREDIT',
  'CARD_TRANSACTION_SETTLED_BY_INVOICE',
  'RECURRENCE_OCCURRENCE_NOT_SKIPPABLE',
  'RECURRENCE_CANCELLED',
  'CATEGORY_NAME_TAKEN',
  'PAYMENT_METHOD_NAME_TAKEN',
  'RECURRENCE_INVALID_STATE',
]);

export const httpStatusFor = (code: BusinessErrorCode): number => {
  if (NOT_FOUND.has(code)) return 404;
  if (CONFLICT.has(code)) return 409;
  return 422;
};

export class BusinessError extends Error {
  readonly code: BusinessErrorCode;
  readonly status: number;
  readonly details?: unknown;

  constructor(code: BusinessErrorCode, message?: string, details?: unknown) {
    super(message ?? code);
    this.name = 'BusinessError';
    this.code = code;
    this.status = httpStatusFor(code);
    this.details = details;
  }
}

export interface ErrorBody {
  error: { code: string; message: string; details?: unknown };
}
