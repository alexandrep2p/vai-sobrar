import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { AuthStore } from '../auth/auth.store';
import { SILENT_ERROR } from './api-client';
import { toApiError } from './api-error';

/**
 * Converte erros HTTP em `ApiError` e os exibe em um snackbar com a mensagem amigável.
 * Sessão ausente/encerrada (401) leva ao login, sem snackbar (auth.md §10). Requisições
 * marcadas com `SILENT_ERROR` têm o erro exibido pela própria tela.
 */
export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const snackBar = inject(MatSnackBar);
  const store = inject(AuthStore);
  const router = inject(Router);
  return next(req).pipe(
    catchError((error: unknown) => {
      if (!(error instanceof HttpErrorResponse)) {
        return throwError(() => error);
      }
      const apiError = toApiError(error);
      // A consulta da sessão (`GET /auth/me`) responde 401 normalmente: quem decide são os guards.
      const sessionProbe = req.method === 'GET' && req.url.endsWith('/auth/me');
      if (apiError.code === 'UNAUTHENTICATED' && !sessionProbe) {
        store.set(null);
        const current = router.url;
        if (!current.startsWith('/login') && !current.startsWith('/cadastro')) {
          void router.navigate(['/login'], {
            queryParams: current && current !== '/' ? { returnUrl: current } : {},
          });
        }
        return throwError(() => apiError);
      }
      if (!req.context.get(SILENT_ERROR) && !sessionProbe) {
        snackBar.open(apiError.message, 'Fechar', { duration: 6000 });
      }
      return throwError(() => apiError);
    }),
  );
};
