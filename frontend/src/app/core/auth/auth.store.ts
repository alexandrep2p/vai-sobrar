import { Injectable, signal } from '@angular/core';

/** Usuário autenticado (auth.md §9: `GET /api/auth/me`). */
export interface User {
  id: string;
  name: string;
  username: string;
  email: string;
}

/**
 * Estado da sessão no frontend, sem dependência de HTTP (usado também pelo interceptor).
 * `undefined` = ainda não consultado; `null` = sem sessão.
 */
@Injectable({ providedIn: 'root' })
export class AuthStore {
  private readonly current = signal<User | null | undefined>(undefined);
  readonly user = this.current.asReadonly();

  set(user: User | null): void {
    this.current.set(user);
  }
}
