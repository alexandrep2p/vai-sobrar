import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { MatSnackBar } from '@angular/material/snack-bar';
import { provideRouter, Router } from '@angular/router';
import { AuthStore } from '../auth/auth.store';
import { ApiClient } from './api-client';
import { ApiError } from './api-error';
import { errorInterceptor } from './error.interceptor';

describe('errorInterceptor', () => {
  let http: HttpClient;
  let controller: HttpTestingController;
  const open = vi.fn();

  beforeEach(() => {
    open.mockClear();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([errorInterceptor])),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: MatSnackBar, useValue: { open } },
      ],
    });
    http = TestBed.inject(HttpClient);
    controller = TestBed.inject(HttpTestingController);
  });

  it('exibe toast amigável e propaga ApiError em erro de negócio', () => {
    let caught: unknown;
    http.get('/api/x').subscribe({ error: (e: unknown) => (caught = e) });
    controller
      .expectOne('/api/x')
      .flush(
        { error: { code: 'PERIOD_CLOSED', message: 'x' } },
        { status: 409, statusText: 'Conflict' },
      );

    expect(caught).toBeInstanceOf(ApiError);
    expect((caught as ApiError).code).toBe('PERIOD_CLOSED');
    expect(open).toHaveBeenCalledWith(
      'Este mês está fechado e não pode ser alterado.',
      'Fechar',
      expect.objectContaining({ duration: 6000 }),
    );
  });

  it('não interfere em respostas de sucesso', () => {
    let result: unknown;
    http.get('/api/x').subscribe((r) => (result = r));
    controller.expectOne('/api/x').flush({ ok: true });
    expect(result).toEqual({ ok: true });
    expect(open).not.toHaveBeenCalled();
  });

  it('401 de sessão encerrada: limpa o usuário e vai ao login guardando o destino, sem snackbar', async () => {
    const router = TestBed.inject(Router);
    const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    vi.spyOn(router, 'url', 'get').mockReturnValue('/faturas');
    const store = TestBed.inject(AuthStore);
    store.set({ id: 'u', name: 'A B', username: 'ab1', email: 'a@b.c' });

    let caught: unknown;
    http.get('/api/transactions').subscribe({ error: (e: unknown) => (caught = e) });
    controller
      .expectOne('/api/transactions')
      .flush({ error: { code: 'UNAUTHENTICATED' } }, { status: 401, statusText: 'Unauthorized' });

    expect((caught as ApiError).code).toBe('UNAUTHENTICATED');
    expect(store.user()).toBeNull();
    expect(navigate).toHaveBeenCalledWith(['/login'], { queryParams: { returnUrl: '/faturas' } });
    expect(open).not.toHaveBeenCalled();
  });

  it('a consulta GET /auth/me sem sessão não redireciona', () => {
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate');
    http.get('/api/auth/me').subscribe({ error: () => undefined });
    controller
      .expectOne('/api/auth/me')
      .flush({ error: { code: 'UNAUTHENTICATED' } }, { status: 401, statusText: 'Unauthorized' });
    expect(navigate).not.toHaveBeenCalled();
    expect(open).not.toHaveBeenCalled();
  });

  it('requisição silenciosa propaga o ApiError sem snackbar', () => {
    let caught: unknown;
    TestBed.inject(ApiClient)
      .post('/auth/register', {}, { silent: true })
      .subscribe({ error: (e: unknown) => (caught = e) });
    controller
      .expectOne('/api/auth/register')
      .flush({ error: { code: 'EMAIL_TAKEN' } }, { status: 409, statusText: 'Conflict' });
    expect((caught as ApiError).code).toBe('EMAIL_TAKEN');
    expect((caught as ApiError).message).toBe('Já existe uma conta com este email.');
    expect(open).not.toHaveBeenCalled();
  });
});
