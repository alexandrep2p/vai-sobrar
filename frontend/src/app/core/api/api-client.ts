import { HttpClient, HttpContext, HttpContextToken, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';

type Params = Record<string, string | number | boolean | undefined>;

const API_BASE = '/api';

/**
 * Requisição cujo erro a própria tela exibe (ex.: no formulário): o interceptor não mostra
 * o snackbar, apenas converte o erro em `ApiError`.
 */
export const SILENT_ERROR = new HttpContextToken<boolean>(() => false);

export interface RequestOptions {
  /** Não exibir o snackbar de erro (a tela trata o `ApiError`). */
  silent?: boolean;
}

const contextFor = (options?: RequestOptions): HttpContext | undefined =>
  options?.silent ? new HttpContext().set(SILENT_ERROR, true) : undefined;

/** Cliente HTTP único da API; o proxy (dev) ou o servidor web (prod) encaminha `/api` ao backend. */
@Injectable({ providedIn: 'root' })
export class ApiClient {
  private readonly http = inject(HttpClient);

  get<T>(path: string, params?: Params, options?: RequestOptions): Observable<T> {
    return this.http.get<T>(API_BASE + path, {
      params: this.toParams(params),
      context: contextFor(options),
    });
  }

  post<T>(path: string, body?: unknown, options?: RequestOptions): Observable<T> {
    return this.http.post<T>(API_BASE + path, body ?? {}, { context: contextFor(options) });
  }

  put<T>(path: string, body: unknown, options?: RequestOptions): Observable<T> {
    return this.http.put<T>(API_BASE + path, body, { context: contextFor(options) });
  }

  delete<T>(path: string, body?: unknown, options?: RequestOptions): Observable<T> {
    return this.http.delete<T>(API_BASE + path, { body, context: contextFor(options) });
  }

  private toParams(params?: Params): HttpParams | undefined {
    if (!params) return undefined;
    let result = new HttpParams();
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined) result = result.set(key, String(value));
    }
    return result;
  }
}
