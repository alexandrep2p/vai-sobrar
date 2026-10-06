import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { TuiNotificationService } from '@taiga-ui/core';
import { catchError, throwError } from 'rxjs';
import { toApiError } from './api-error';

/** Converte erros HTTP em `ApiError` e os exibe em uma notificação com a mensagem amigável. */
export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const notifications = inject(TuiNotificationService);
  return next(req).pipe(
    catchError((error: unknown) => {
      if (!(error instanceof HttpErrorResponse)) {
        return throwError(() => error);
      }
      const apiError = toApiError(error);
      notifications.open(apiError.message, { appearance: 'negative', autoClose: 6000 }).subscribe();
      return throwError(() => apiError);
    }),
  );
};
