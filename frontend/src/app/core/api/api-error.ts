import { HttpErrorResponse } from '@angular/common/http';
import { messageForCode, NETWORK_ERROR_MESSAGE } from './error-messages';

/** Erro da API normalizado: `code` vem do backend; `message` é sempre em português e amigável. */
export class ApiError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status: number,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

interface ErrorBody {
  error?: { code?: unknown; details?: unknown };
}

export function toApiError(response: HttpErrorResponse): ApiError {
  if (response.status === 0) {
    return new ApiError('NETWORK_ERROR', NETWORK_ERROR_MESSAGE, 0);
  }
  const body = (response.error ?? {}) as ErrorBody;
  const code = typeof body.error?.code === 'string' ? body.error.code : 'UNKNOWN_ERROR';
  return new ApiError(code, messageForCode(code), response.status, body.error?.details);
}
