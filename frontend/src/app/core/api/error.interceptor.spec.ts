import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { TuiNotificationService } from '@taiga-ui/core';
import { EMPTY } from 'rxjs';
import { ApiError } from './api-error';
import { errorInterceptor } from './error.interceptor';

describe('errorInterceptor', () => {
  let http: HttpClient;
  let controller: HttpTestingController;
  const open = vi.fn(() => EMPTY);

  beforeEach(() => {
    open.mockClear();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([errorInterceptor])),
        provideHttpClientTesting(),
        { provide: TuiNotificationService, useValue: { open } },
      ],
    });
    http = TestBed.inject(HttpClient);
    controller = TestBed.inject(HttpTestingController);
  });

  it('exibe notificação amigável e propaga ApiError em erro de negócio', () => {
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
      expect.objectContaining({ appearance: 'negative', autoClose: 6000 }),
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
