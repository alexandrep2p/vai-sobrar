import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { MatSnackBar } from '@angular/material/snack-bar';
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
});
