import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { MatSnackBar } from '@angular/material/snack-bar';
import { provideRouter } from '@angular/router';
import { errorInterceptor } from '../api/error.interceptor';
import { safeReturnUrl } from './auth.guards';
import { AuthService } from './auth.service';
import { AuthStore, type User } from './auth.store';

const USER: User = { id: 'u1', name: 'Ana Souza', username: 'Ana.Souza', email: 'ana@x.com' };

describe('AuthService', () => {
  let auth: AuthService;
  let http: HttpTestingController;
  let store: AuthStore;
  const open = vi.fn();

  beforeEach(() => {
    open.mockClear();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors([errorInterceptor])),
        provideHttpClientTesting(),
        { provide: MatSnackBar, useValue: { open } },
      ],
    });
    auth = TestBed.inject(AuthService);
    http = TestBed.inject(HttpTestingController);
    store = TestBed.inject(AuthStore);
  });

  it('loadMe guarda o usuário da sessão', () => {
    let result: User | null | undefined;
    auth.loadMe().subscribe((u) => (result = u));
    http.expectOne({ method: 'GET', url: '/api/auth/me' }).flush(USER);
    expect(result).toEqual(USER);
    expect(store.user()).toEqual(USER);
  });

  it('loadMe sem sessão resulta em null, sem snackbar', () => {
    let result: User | null | undefined;
    auth.loadMe().subscribe((u) => (result = u));
    http
      .expectOne('/api/auth/me')
      .flush({ error: { code: 'UNAUTHENTICATED' } }, { status: 401, statusText: 'Unauthorized' });
    expect(result).toBeNull();
    expect(store.user()).toBeNull();
    expect(open).not.toHaveBeenCalled();
  });

  it('ensureLoaded consulta a API só uma vez', () => {
    auth.ensureLoaded().subscribe();
    http.expectOne('/api/auth/me').flush(USER);
    let again: User | null | undefined;
    auth.ensureLoaded().subscribe((u) => (again = u));
    http.expectNone('/api/auth/me');
    expect(again).toEqual(USER);
  });

  it('login guarda o usuário; erro de credencial não mostra snackbar', () => {
    auth.login({ email: 'ana@x.com', password: 'x' }).subscribe({ error: () => undefined });
    const req = http.expectOne({ method: 'POST', url: '/api/auth/login' });
    expect(req.request.body).toEqual({ email: 'ana@x.com', password: 'x' });
    req.flush(
      { error: { code: 'INVALID_CREDENTIALS' } },
      { status: 401, statusText: 'Unauthorized' },
    );
    expect(open).not.toHaveBeenCalled();
    expect(store.user()).toBeUndefined();

    auth.login({ email: 'ana@x.com', password: 'y' }).subscribe();
    http.expectOne('/api/auth/login').flush(USER);
    expect(store.user()).toEqual(USER);
  });

  it('cadastro não abre sessão', () => {
    auth
      .register({ name: 'Ana Souza', username: 'Ana.Souza', email: 'ana@x.com', password: 'p' })
      .subscribe();
    http.expectOne({ method: 'POST', url: '/api/auth/register' }).flush(USER);
    expect(store.user()).toBeUndefined();
  });

  it('editar perfil atualiza o usuário; excluir conta limpa a sessão', () => {
    store.set(USER);
    auth.updateProfile({ name: 'Ana Maria' }).subscribe();
    http.expectOne({ method: 'PUT', url: '/api/auth/me' }).flush({ ...USER, name: 'Ana Maria' });
    expect(store.user()?.name).toBe('Ana Maria');

    auth.deleteAccount('senha').subscribe();
    const req = http.expectOne({ method: 'DELETE', url: '/api/auth/me' });
    expect(req.request.body).toEqual({ password: 'senha' });
    req.flush(null, { status: 204, statusText: 'No Content' });
    expect(store.user()).toBeNull();
  });

  it('trocar senha envia senha atual e nova', () => {
    auth.changePassword({ current_password: 'a', new_password: 'b' }).subscribe();
    const req = http.expectOne({ method: 'POST', url: '/api/auth/me/password' });
    expect(req.request.body).toEqual({ current_password: 'a', new_password: 'b' });
    req.flush(null, { status: 204, statusText: 'No Content' });
  });
});

describe('safeReturnUrl', () => {
  it.each([
    ['/faturas', '/faturas'],
    ['/home?month=2027-10', '/home?month=2027-10'],
    [null, '/home'],
    ['', '/home'],
    ['https://evil.com', '/home'],
    ['//evil.com', '/home'],
    ['/login', '/home'],
    ['/cadastro', '/home'],
  ])('%s → %s', (input, expected) => {
    expect(safeReturnUrl(input)).toBe(expected);
  });
});
