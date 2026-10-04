const GENERIC_MESSAGE = 'Não foi possível concluir a operação. Tente novamente.';

export const NETWORK_ERROR_MESSAGE =
  'Não foi possível se comunicar com o servidor. Verifique sua conexão.';

export const ERROR_MESSAGES: Readonly<Record<string, string>> = {
  PERIOD_CLOSED: 'Este mês está fechado e não pode ser alterado.',
  PERIOD_HAS_PENDING_TRANSACTIONS: 'O mês possui lançamentos em aberto ou ocorrências projetadas.',
  PERIOD_HAS_UNPAID_INVOICES: 'O mês possui faturas que ainda não foram pagas.',
  PERIOD_PREVIOUS_NOT_CLOSED: 'Feche primeiro os meses anteriores que possuem lançamentos.',
  PERIOD_FUTURE_NOT_CLOSABLE: 'Um mês futuro não pode ser fechado.',
  TRANSACTION_NOT_FOUND: 'Lançamento não encontrado.',
  TRANSACTION_NOT_EDITABLE: 'Este lançamento não pode ser editado.',
  TRANSACTION_NOT_DELETABLE: 'Este lançamento não pode ser excluído.',
  CATEGORY_INACTIVE: 'A categoria está inativa.',
  CATEGORY_TYPE_MISMATCH: 'O tipo da categoria não corresponde ao tipo do lançamento.',
  CATEGORY_TYPE_LOCKED: 'O tipo desta categoria não pode mais ser alterado.',
  PAYMENT_METHOD_INACTIVE: 'O método de pagamento está inativo.',
  PAYMENT_METHOD_NOT_EDITABLE: 'Este método de pagamento não pode ser editado.',
  CARD_INACTIVE: 'O cartão está inativo.',
  INVOICE_ALREADY_PAID: 'Esta fatura já foi paga.',
  INVOICE_PAYMENT_METHOD_INVALID: 'O método escolhido não pode ser usado para pagar a fatura.',
  INVOICE_NOT_OPEN_FOR_CREDIT: 'A fatura não está disponível para receber o crédito.',
  CARD_TRANSACTION_SETTLED_BY_INVOICE: 'Compras no cartão são liquidadas pelo pagamento da fatura.',
  INVALID_PAYMENT_DATE: 'Data de pagamento inválida.',
  INVALID_PURCHASE_DATE: 'Data da compra inválida.',
  INVALID_INSTALLMENT_OPERATION: 'Esta operação não é permitida em compras parceladas.',
  REFUND_TARGET_NOT_ALLOWED: 'Esta compra não pode ser estornada.',
  REFUND_EXCEEDS_REMAINING_AMOUNT:
    'O valor do estorno excede o saldo que ainda pode ser estornado.',
  INVALID_REFUND_DATE: 'Data do estorno inválida.',
  RECURRENCE_OCCURRENCE_NOT_SKIPPABLE: 'Esta ocorrência não pode ser pulada.',
  RECURRENCE_CANCELLED: 'A recorrência está cancelada.',
  CATEGORY_NOT_FOUND: 'Categoria não encontrada.',
  CATEGORY_NAME_TAKEN: 'Já existe uma categoria com este nome.',
  PAYMENT_METHOD_NOT_FOUND: 'Método de pagamento não encontrado.',
  PAYMENT_METHOD_NAME_TAKEN: 'Já existe um método de pagamento com este nome.',
  CARD_NOT_FOUND: 'Cartão não encontrado.',
  INVOICE_NOT_FOUND: 'Fatura não encontrada.',
  INSTALLMENT_PLAN_NOT_FOUND: 'Compra parcelada não encontrada.',
  REFUND_NOT_FOUND: 'Estorno não encontrado.',
  RECURRENCE_NOT_FOUND: 'Recorrência não encontrada.',
  RECURRENCE_OCCURRENCE_NOT_FOUND: 'Ocorrência não encontrada.',
  RECURRENCE_INVALID_STATE: 'A situação atual da recorrência não permite esta ação.',
  INVALID_DUE_DATE: 'Data de vencimento inválida.',
  INVALID_PAUSE_PERIOD: 'Período de pausa inválido.',
  VALIDATION_ERROR: 'Alguns dados informados são inválidos. Revise e tente novamente.',
  INVALID_JSON: GENERIC_MESSAGE,
  INTERNAL_ERROR: 'Ocorreu um erro inesperado no servidor. Tente novamente mais tarde.',
};

/** Mensagem amigável para um código de erro; códigos desconhecidos usam a mensagem genérica. */
export function messageForCode(code: string | undefined): string {
  return (code && ERROR_MESSAGES[code]) || GENERIC_MESSAGE;
}
