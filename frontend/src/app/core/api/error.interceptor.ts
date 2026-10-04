import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { catchError, throwError } from 'rxjs';
import { toApiError } from './api-error';

/** Converte erros HTTP em `ApiError` e os exibe em um snackbar com a mensagem amigável. */
export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const snackBar = inject(MatSnackBar);
  return next(req).pipe(
    catchError((error: unknown) => {
      if (!(error instanceof HttpErrorResponse)) {
        return throwError(() => error);
      }
      const apiError = toApiError(error);
      snackBar.open(apiError.message, 'Fechar', { duration: 6000 });
      return throwError(() => apiError);
    }),
  );
};
