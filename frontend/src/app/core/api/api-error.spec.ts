import { HttpErrorResponse } from '@angular/common/http';
import { toApiError } from './api-error';
import { ERROR_MESSAGES, messageForCode, NETWORK_ERROR_MESSAGE } from './error-messages';

const response = (status: number, error: unknown) => new HttpErrorResponse({ status, error });

describe('toApiError', () => {
  it('mapeia o código de negócio para mensagem em português, ignorando o texto do backend', () => {
    const err = toApiError(
      response(409, { error: { code: 'PERIOD_CLOSED', message: 'texto interno' } }),
    );
    expect(err.code).toBe('PERIOD_CLOSED');
    expect(err.status).toBe(409);
    expect(err.message).toBe(ERROR_MESSAGES['PERIOD_CLOSED']);
    expect(err.message).not.toContain('texto interno');
  });

  it('preserva os detalhes de validação', () => {
    const details = [{ path: 'name', message: 'x' }];
    const err = toApiError(response(400, { error: { code: 'VALIDATION_ERROR', details } }));
    expect(err.code).toBe('VALIDATION_ERROR');
    expect(err.details).toEqual(details);
  });

  it('trata falha de rede', () => {
    const err = toApiError(response(0, null));
    expect(err.code).toBe('NETWORK_ERROR');
    expect(err.message).toBe(NETWORK_ERROR_MESSAGE);
  });

  it('usa mensagem genérica para corpo ausente ou código desconhecido', () => {
    const noBody = toApiError(response(502, 'Bad Gateway'));
    expect(noBody.code).toBe('UNKNOWN_ERROR');
    const unknown = toApiError(response(422, { error: { code: 'NOVO_CODIGO' } }));
    expect(unknown.message).toBe(messageForCode(undefined));
  });
});

describe('ERROR_MESSAGES', () => {
  it('cobre os códigos de negócio de architecture §23 e os técnicos do backend', () => {
    const codes = [
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
      'VALIDATION_ERROR',
      'INTERNAL_ERROR',
    ];
    for (const code of codes) {
      expect(ERROR_MESSAGES[code], code).toBeTruthy();
    }
  });
});
