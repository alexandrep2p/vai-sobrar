import { yearMonthOf, type LocalDate, type YearMonth } from '../shared/dates.js';
import { BusinessError, type BusinessErrorCode } from '../shared/errors.js';
import type { ClosedMonths, InvoiceSnapshot } from './types.js';

export type Verdict = { allowed: true } | { allowed: false; code: BusinessErrorCode };

const ALLOWED: Verdict = { allowed: true };
const deny = (code: BusinessErrorCode): Verdict => ({ allowed: false, code });

/** Converte um veredito negativo em `BusinessError`; usado pelos casos de uso. */
export const assertAllowed = (verdict: Verdict): void => {
  if (!verdict.allowed) throw new BusinessError(verdict.code);
};

// ---- Barreira de mês fechado e de fatura (financial-periods.md §5, invoices.md §5.1) ----

export const monthOperationVerdict = (month: YearMonth, closedMonths: ClosedMonths): Verdict =>
  closedMonths.has(month) ? deny('PERIOD_CLOSED') : ALLOWED;

/** Nenhuma operação modifica fatura `PAID` ou de mês fechado. */
export const invoiceModificationVerdict = (
  invoice: Pick<InvoiceSnapshot, 'status' | 'referenceMonth'>,
  closedMonths: ClosedMonths,
): Verdict => {
  if (closedMonths.has(invoice.referenceMonth)) return deny('PERIOD_CLOSED');
  if (invoice.status === 'PAID') return deny('INVOICE_ALREADY_PAID');
  return ALLOWED;
};

/** invoices.md §5.1: compra do ciclo e compra tardia entram em fatura `OPEN` ou `CLOSED`. */
export const invoiceAcceptsPurchase = (
  invoice: Pick<InvoiceSnapshot, 'status' | 'referenceMonth'>,
  closedMonths: ClosedMonths,
): Verdict => invoiceModificationVerdict(invoice, closedMonths);

/** invoices.md §5.1 (PD-23): crédito de estorno só em fatura `OPEN` com mês aberto. */
export const invoiceAcceptsRefundCredit = (
  invoice: Pick<InvoiceSnapshot, 'status' | 'referenceMonth'>,
  closedMonths: ClosedMonths,
): Verdict => {
  const base = invoiceModificationVerdict(invoice, closedMonths);
  if (!base.allowed) return base;
  return invoice.status === 'OPEN' ? ALLOWED : deny('INVOICE_NOT_OPEN_FOR_CREDIT');
};

// ---- Matriz de edição (transactions.md §12) ----

export type TransactionOrigin = 'MANUAL' | 'CREDIT_CARD' | 'INSTALLMENT' | 'RECURRENCE';

export type EditableField =
  'description' | 'amount' | 'dueDate' | 'purchaseDate' | 'category' | 'paymentMethod' | 'status';

/** Parcela de um plano, para a regra do plano inteiro (nota ²). */
export interface PlanInstallmentState {
  monthClosed: boolean;
  invoicePaid: boolean;
}

export interface TransactionEditContext {
  origin: TransactionOrigin;
  /** Só relevante para `RECURRENCE`: a ocorrência é paga com cartão. */
  recurrencePaidWithCard?: boolean;
  /** O mês financeiro do lançamento está fechado. */
  monthClosed: boolean;
  /** Lançamento de cartão: a fatura de postagem está `PAID`. */
  invoicePaid?: boolean;
  /** `INSTALLMENT`: estado de todas as parcelas do plano. */
  planInstallments?: readonly PlanInstallmentState[];
}

/** YES: sim · NO: não · INVOICE: sim com fatura não `PAID` (¹) · PLAN: plano inteiro (²). */
type Cell = 'YES' | 'NO' | 'INVOICE' | 'PLAN';
type MatrixRow = Record<EditableField, Cell>;

const MANUAL: MatrixRow = {
  description: 'YES',
  amount: 'YES',
  dueDate: 'YES',
  purchaseDate: 'NO',
  category: 'YES',
  paymentMethod: 'YES',
  status: 'YES',
};
const RECURRENCE_COMMON: MatrixRow = { ...MANUAL, category: 'NO' };
const RECURRENCE_CARD: MatrixRow = {
  description: 'INVOICE',
  amount: 'INVOICE',
  dueDate: 'NO',
  purchaseDate: 'NO',
  category: 'NO',
  paymentMethod: 'NO',
  status: 'NO',
};
const CREDIT_CARD: MatrixRow = { ...RECURRENCE_CARD, amount: 'NO', category: 'INVOICE' };
const INSTALLMENT: MatrixRow = {
  ...RECURRENCE_CARD,
  description: 'PLAN',
  amount: 'NO',
  category: 'PLAN',
};

const isCardPosted = (ctx: TransactionEditContext): boolean =>
  ctx.origin === 'CREDIT_CARD' ||
  ctx.origin === 'INSTALLMENT' ||
  (ctx.origin === 'RECURRENCE' && ctx.recurrencePaidWithCard === true);

const rowFor = (ctx: TransactionEditContext): MatrixRow => {
  switch (ctx.origin) {
    case 'MANUAL':
      return MANUAL;
    case 'CREDIT_CARD':
      return CREDIT_CARD;
    case 'INSTALLMENT':
      return INSTALLMENT;
    case 'RECURRENCE':
      return isCardPosted(ctx) ? RECURRENCE_CARD : RECURRENCE_COMMON;
  }
};

/**
 * Se um campo do lançamento pode ser alterado. Ordem: mês fechado bloqueia tudo; fatura
 * `PAID` bloqueia todos os campos de lançamento de cartão; depois a matriz da §12.
 * (O tipo da nova categoria e a atividade de categoria/método ficam nos casos de uso.)
 */
export const canEditField = (ctx: TransactionEditContext, field: EditableField): Verdict => {
  if (ctx.monthClosed) return deny('PERIOD_CLOSED');
  const cardPosted = isCardPosted(ctx);
  if (cardPosted && ctx.invoicePaid) return deny('INVOICE_ALREADY_PAID');

  const cell = rowFor(ctx)[field];
  switch (cell) {
    case 'YES':
    case 'INVOICE': // fatura `PAID` já foi tratada acima
      return ALLOWED;
    case 'PLAN': {
      const plan = ctx.planInstallments ?? [];
      const editable = plan.every((p) => !p.monthClosed && !p.invoicePaid);
      return editable ? ALLOWED : deny('INVALID_INSTALLMENT_OPERATION');
    }
    case 'NO':
      return deny(
        field === 'status' && cardPosted
          ? 'CARD_TRANSACTION_SETTLED_BY_INVOICE'
          : 'TRANSACTION_NOT_EDITABLE',
      );
  }
};

/** transactions.md §7: método comum só é trocado por outro método comum. */
export const paymentMethodChangeVerdict = (currentIsCard: boolean, nextIsCard: boolean): Verdict =>
  currentIsCard || nextIsCard ? deny('TRANSACTION_NOT_EDITABLE') : ALLOWED;

/** transactions.md §11: origem e destino do `due_date` precisam estar em meses abertos. */
export const dueDateMoveVerdict = (
  from: LocalDate,
  to: LocalDate,
  closedMonths: ClosedMonths,
): Verdict => {
  const origin = monthOperationVerdict(yearMonthOf(from), closedMonths);
  return origin.allowed ? monthOperationVerdict(yearMonthOf(to), closedMonths) : origin;
};

/** transactions.md §13: exclusão física somente de `MANUAL` com o mês aberto. */
export const canDeleteTransaction = (
  ctx: Pick<TransactionEditContext, 'origin' | 'monthClosed'>,
): Verdict => {
  if (ctx.origin !== 'MANUAL') return deny('TRANSACTION_NOT_DELETABLE');
  return ctx.monthClosed ? deny('PERIOD_CLOSED') : ALLOWED;
};
