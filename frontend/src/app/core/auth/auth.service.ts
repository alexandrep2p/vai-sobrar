import { inject, Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, finalize, map, Observable, of, tap } from 'rxjs';
import { ApiClient } from '../api/api-client';
import { AuthStore, type User } from './auth.store';

export interface RegisterInput {
  name: string;
  username: string;
  email: string;
  password: string;
}

const SILENT = { silent: true };

/** Contas e sessão (auth.md). A sessão vive num cookie httpOnly; o frontend só guarda o usuário. */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly api = inject(ApiClient);
  private readonly store = inject(AuthStore);
  private readonly router = inject(Router);

  readonly user = this.store.user;

  /** Consulta o usuário da sessão; sem sessão, `null`. */
  loadMe(): Observable<User | null> {
    return this.api.get<User>('/auth/me', undefined, SILENT).pipe(
      catchError(() => of(null)),
      tap((user) => this.store.set(user)),
    );
  }

  /** Usuário atual, consultando a API só na primeira vez. */
  ensureLoaded(): Observable<User | null> {
    const user = this.store.user();
    return user === undefined ? this.loadMe() : of(user);
  }

  login(body: { email: string; password: string }): Observable<User> {
    return this.api
      .post<User>('/auth/login', body, SILENT)
      .pipe(tap((user) => this.store.set(user)));
  }

  register(body: RegisterInput): Observable<User> {
    return this.api.post<User>('/auth/register', body, SILENT);
  }

  /** Encerra a sessão atual e volta ao login (mesmo se a API falhar). */
  logout(): void {
    this.api
      .post<void>('/auth/logout', {}, SILENT)
      .pipe(
        catchError(() => of(undefined)),
        finalize(() => {
          this.store.set(null);
          void this.router.navigateByUrl('/login');
        }),
      )
      .subscribe();
  }

  updateProfile(body: { name?: string; username?: string }): Observable<User> {
    return this.api.put<User>('/auth/me', body, SILENT).pipe(tap((user) => this.store.set(user)));
  }

  changePassword(body: { current_password: string; new_password: string }): Observable<void> {
    return this.api.post<void>('/auth/me/password', body, SILENT);
  }

  /** Exclui a conta; em seguida não há mais sessão. */
  deleteAccount(password: string): Observable<void> {
    return this.api.delete<void>('/auth/me', { password }, SILENT).pipe(
      tap(() => this.store.set(null)),
      map(() => undefined),
    );
  }
}
