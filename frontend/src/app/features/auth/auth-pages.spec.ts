import { TestBed } from '@angular/core/testing';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ActivatedRoute, convertToParamMap, provideRouter, Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { ApiError } from '../../core/api/api-error';
import { AuthService } from '../../core/auth/auth.service';
import { all, one, submitButton, text, type } from '../../../testing/helpers';
import { LoginPage } from './login.page';
import { PasswordChecklist } from './password-checklist';
import { RegisterPage } from './register.page';

const USER = { id: 'u1', name: 'Ana Souza', username: 'Ana.Souza', email: 'ana@x.com' };
const apiError = (code: string, message = 'Mensagem') => new ApiError(code, message, 409);

describe('PasswordChecklist', () => {
  it('marca os requisitos atendidos a cada mudança', async () => {
    const fixture = TestBed.createComponent(PasswordChecklist);
    fixture.componentRef.setInput('password', 'abc');
    fixture.detectChanges();
    const met = () => all(fixture, 'li.met').map((li) => li.dataset['rule']);
    expect(met()).toEqual(['letter']);
    fixture.componentRef.setInput('password', 'abc123!@');
    fixture.detectChanges();
    expect(met()).toEqual(['length', 'letter', 'digit', 'special']);
    expect(text(fixture)).toContain('Pelo menos 8 caracteres');
  });
});

describe('LoginPage', () => {
  const auth = { login: vi.fn() };
  let returnUrl: string | null = null;

  beforeEach(() => {
    vi.resetAllMocks();
    returnUrl = null;
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: auth },
        {
          provide: ActivatedRoute,
          useFactory: () => ({
            snapshot: { queryParamMap: convertToParamMap(returnUrl ? { returnUrl } : {}) },
          }),
        },
      ],
    });
  });

  async function render() {
    const fixture = TestBed.createComponent(LoginPage);
    fixture.detectChanges();
    await fixture.whenStable();
    return fixture;
  }

  async function fill(fixture: Awaited<ReturnType<typeof render>>) {
    await type(fixture, one(fixture, 'input[formcontrolname="email"]'), ' ana@x.com ');
    await type(fixture, one(fixture, 'input[formcontrolname="password"]'), 'abc123!@');
  }

  it('botão desabilitado até preencher; entra e vai ao destino guardado', async () => {
    returnUrl = '/faturas';
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    auth.login.mockReturnValue(of(USER));
    const fixture = await render();
    expect(submitButton(fixture).disabled).toBe(true);
    await fill(fixture);
    expect(submitButton(fixture).disabled).toBe(false);
    submitButton(fixture).click();
    expect(auth.login).toHaveBeenCalledWith({ email: 'ana@x.com', password: 'abc123!@' });
    expect(navigate).toHaveBeenCalledWith('/faturas');
  });

  it('sem destino vai para a home; destino externo é ignorado', async () => {
    returnUrl = 'https://evil.com';
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    auth.login.mockReturnValue(of(USER));
    const fixture = await render();
    await fill(fixture);
    submitButton(fixture).click();
    expect(navigate).toHaveBeenCalledWith('/home');
  });

  it('credenciais inválidas: mensagem no formulário e botão reabilitado', async () => {
    auth.login.mockReturnValue(
      throwError(() => apiError('INVALID_CREDENTIALS', 'Email ou senha inválidos.')),
    );
    const fixture = await render();
    await fill(fixture);
    submitButton(fixture).click();
    fixture.detectChanges();
    expect(one(fixture, '[data-testid="form-error"]').textContent).toContain(
      'Email ou senha inválidos.',
    );
    expect(submitButton(fixture).disabled).toBe(false);
  });

  it('mostrar/ocultar senha', async () => {
    const fixture = await render();
    const input = one<HTMLInputElement>(fixture, 'input[formcontrolname="password"]');
    expect(input.type).toBe('password');
    one(fixture, 'button[aria-label="Mostrar senha"]').click();
    fixture.detectChanges();
    expect(input.type).toBe('text');
  });

  it('tem link para criar conta', async () => {
    const fixture = await render();
    expect(one(fixture, 'a[href="/cadastro"]').textContent).toContain('Criar conta');
  });
});

describe('RegisterPage', () => {
  const auth = { register: vi.fn() };
  const snackBar = { open: vi.fn() };

  beforeEach(() => {
    vi.resetAllMocks();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: auth },
        { provide: MatSnackBar, useValue: snackBar },
      ],
    });
  });

  async function render() {
    const fixture = TestBed.createComponent(RegisterPage);
    fixture.detectChanges();
    await fixture.whenStable();
    return fixture;
  }

  const input = (fixture: Awaited<ReturnType<typeof render>>, name: string) =>
    one<HTMLInputElement>(fixture, `input[formcontrolname="${name}"]`);

  async function fill(
    fixture: Awaited<ReturnType<typeof render>>,
    over: Partial<Record<string, string>> = {},
  ) {
    const values = {
      name: '  Ana   Souza ',
      username: 'Ana.Souza',
      email: 'ana@x.com',
      password: 'abc123!@',
      confirm: 'abc123!@',
      ...over,
    };
    for (const [name, value] of Object.entries(values))
      await type(fixture, input(fixture, name), value);
  }

  it('valida em tempo real e envia o cadastro normalizado; vai ao login com o email', async () => {
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    auth.register.mockReturnValue(of(USER));
    const fixture = await render();
    expect(submitButton(fixture).disabled).toBe(true);

    await type(fixture, input(fixture, 'password'), 'abc');
    expect(all(fixture, 'app-password-checklist li.met')).toHaveLength(1);

    await fill(fixture);
    expect(all(fixture, 'app-password-checklist li.met')).toHaveLength(4);
    expect(submitButton(fixture).disabled).toBe(false);
    submitButton(fixture).click();

    expect(auth.register).toHaveBeenCalledWith({
      name: 'Ana Souza',
      username: 'Ana.Souza',
      email: 'ana@x.com',
      password: 'abc123!@',
    });
    expect(snackBar.open).toHaveBeenCalledWith(
      'Conta criada. Entre com seu email e senha.',
      'Fechar',
      expect.anything(),
    );
    expect(navigate).toHaveBeenCalledWith('/login', { state: { email: 'ana@x.com' } });
  });

  it.each([
    ['nome com uma palavra', { name: 'Ana' }, 'Informe nome e sobrenome.'],
    ['username inválido', { username: 'ana_souza' }, 'Use 3 a 30 caracteres'],
    ['senha fraca', { password: 'abcdefgh', confirm: 'abcdefgh' }, 'não atende aos requisitos'],
    ['confirmação diferente', { confirm: 'abc123!#' }, 'As senhas não conferem.'],
  ])('bloqueia %s', async (_label, over, message) => {
    const fixture = await render();
    await fill(fixture, over);
    for (const field of ['name', 'username', 'email', 'password', 'confirm']) {
      input(fixture, field).dispatchEvent(new Event('blur'));
    }
    fixture.detectChanges();
    expect(submitButton(fixture).disabled).toBe(true);
    expect(text(fixture)).toContain(message);
  });

  it('email ou username já usados aparecem no campo', async () => {
    auth.register.mockReturnValueOnce(throwError(() => apiError('EMAIL_TAKEN')));
    const fixture = await render();
    await fill(fixture);
    submitButton(fixture).click();
    fixture.detectChanges();
    expect(text(fixture)).toContain('Já existe uma conta com este email.');

    auth.register.mockReturnValueOnce(throwError(() => apiError('USERNAME_TAKEN')));
    await type(fixture, input(fixture, 'email'), 'outra@x.com');
    submitButton(fixture).click();
    fixture.detectChanges();
    expect(text(fixture)).toContain('Este username já está em uso.');
  });

  it('outros erros aparecem no topo do formulário', async () => {
    auth.register.mockReturnValue(
      throwError(() => apiError('TOO_MANY_ATTEMPTS', 'Muitas tentativas.')),
    );
    const fixture = await render();
    await fill(fixture);
    submitButton(fixture).click();
    fixture.detectChanges();
    expect(one(fixture, '[data-testid="form-error"]').textContent).toContain('Muitas tentativas.');
  });
});
