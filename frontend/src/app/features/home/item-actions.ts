import type { StatementItem } from '../../core/api/models';

/** Ações disponíveis em um item do extrato. O backend continua sendo a autoridade (architecture §16). */
export interface ItemActions {
  edit: boolean;
  pay: boolean;
  unpay: boolean;
  delete: boolean;
  skip: boolean;
  refund: boolean;
  /** Item de cartão: o status só muda pelo pagamento da fatura (invoices.md §9.3). */
  settledByInvoice: boolean;
}

/** Campos editáveis de um item (transactions.md §12 e recurrences.md §9). */
export interface EditableFields {
  description: boolean;
  amount: boolean;
  dueDate: boolean;
  category: boolean;
  method: boolean;
}

const NONE: ItemActions = {
  edit: false,
  pay: false,
  unpay: false,
  delete: false,
  skip: false,
  refund: false,
  settledByInvoice: false,
};

const isCard = (item: StatementItem): boolean => item.credit_card !== null;

export function itemActions(item: StatementItem, monthOpen: boolean): ItemActions {
  if (!monthOpen || item.item_type === 'REFUND_CREDIT') return NONE;

  const card = isCard(item);
  const invoicePaid = item.invoice?.status === 'PAID';
  const pending = item.status === 'PENDING';

  if (item.item_type === 'PROJECTED_OCCURRENCE') {
    return { ...NONE, edit: true, pay: !card, skip: true, settledByInvoice: card };
  }

  switch (item.origin) {
    case 'MANUAL':
      return { ...NONE, edit: true, pay: pending, unpay: !pending, delete: true };
    case 'RECURRENCE':
      return card
        ? { ...NONE, edit: !invoicePaid, refund: true, settledByInvoice: true }
        : { ...NONE, edit: true, pay: pending, unpay: !pending, skip: pending };
    case 'CREDIT_CARD':
    case 'INSTALLMENT':
      return { ...NONE, edit: !invoicePaid, refund: true, settledByInvoice: true };
    default:
      return NONE;
  }
}

export function editableFields(item: StatementItem): EditableFields {
  const card = isCard(item);
  const origin = item.item_type === 'PROJECTED_OCCURRENCE' ? 'RECURRENCE' : item.origin;
  return {
    description: true,
    amount: origin === 'MANUAL' || origin === 'RECURRENCE',
    dueDate: !card && (origin === 'MANUAL' || origin === 'RECURRENCE'),
    category: origin === 'MANUAL' || origin === 'CREDIT_CARD' || origin === 'INSTALLMENT',
    method: !card && (origin === 'MANUAL' || origin === 'RECURRENCE'),
  };
}

/** Chave do alvo de estorno de um item de cartão (compra à vista/ocorrência ou plano de parcelas). */
export function refundTargetKey(item: StatementItem): string | null {
  if (item.item_type !== 'TRANSACTION' || !isCard(item)) return null;
  if (item.installment) return `plan:${item.installment.installment_plan_id}`;
  return item.transaction_id ? `tx:${item.transaction_id}` : null;
}
