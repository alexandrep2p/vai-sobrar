import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';

type Params = Record<string, string | number | boolean | undefined>;

const API_BASE = '/api';

/** Cliente HTTP único da API; o proxy (dev) ou o servidor web (prod) encaminha `/api` ao backend. */
@Injectable({ providedIn: 'root' })
export class ApiClient {
  private readonly http = inject(HttpClient);

  get<T>(path: string, params?: Params): Observable<T> {
    return this.http.get<T>(API_BASE + path, { params: this.toParams(params) });
  }

  post<T>(path: string, body?: unknown): Observable<T> {
    return this.http.post<T>(API_BASE + path, body ?? {});
  }

  put<T>(path: string, body: unknown): Observable<T> {
    return this.http.put<T>(API_BASE + path, body);
  }

  delete<T>(path: string): Observable<T> {
    return this.http.delete<T>(API_BASE + path);
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
