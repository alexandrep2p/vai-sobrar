import { inject } from '@angular/core';
import { Router, type CanActivateFn } from '@angular/router';
import { map } from 'rxjs';
import { AuthService } from './auth.service';

/** Telas da aplicação exigem login; sem sessão vai ao login e volta depois (auth.md §10). */
export const authGuard: CanActivateFn = (_route, state) => {
  const router = inject(Router);
  return inject(AuthService)
    .ensureLoaded()
    .pipe(
      map((user) =>
        user
          ? true
          : router.createUrlTree(['/login'], {
              // A home já é o destino padrão do login.
              queryParams: ['', '/', '/home'].includes(state.url) ? {} : { returnUrl: state.url },
            }),
      ),
    );
};

/** Login e cadastro são só para quem não está conectado. */
export const guestGuard: CanActivateFn = () => {
  const router = inject(Router);
  return inject(AuthService)
    .ensureLoaded()
    .pipe(map((user) => (user ? router.createUrlTree(['/home']) : true)));
};

/** Destino seguro após o login: só caminhos internos da aplicação. */
export function safeReturnUrl(value: string | null | undefined): string {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return '/home';
  if (value.startsWith('/login') || value.startsWith('/cadastro')) return '/home';
  return value;
}
