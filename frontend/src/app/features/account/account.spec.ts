import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { provideRouter, Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { ApiError } from '../../core/api/api-error';
import { AuthService } from '../../core/auth/auth.service';
import { one, text, type } from '../../../testing/helpers';
import { AccountPage } from './account.page';
import { DeleteAccountDialog } from './delete-account-dialog';

const USER = { id: 'u1', name: 'Ana Souza', username: 'Ana.Souza', email: 'ana@x.com' };
const apiError = (code: string) => new ApiError(code, 'Mensagem', 422);

describe('AccountPage', () => {
  const auth = {
    user: signal(USER),
    updateProfile: vi.fn(),
    changePassword: vi.fn(),
  };
  const snackBar = { open: vi.fn() };
  const dialog = { open: vi.fn() };

  beforeEach(() => {
    vi.resetAllMocks();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: auth },
        { provide: MatSnackBar, useValue: snackBar },
        { provide: MatDialog, useValue: dialog },
      ],
    });
  });

  async function render() {
    const fixture = TestBed.createComponent(AccountPage);
    fixture.detectChanges();
    await fixture.whenStable();
    return fixture;
  }
  const input = (fixture: Awaited<ReturnType<typeof render>>, name: string) =>
    one<HTMLInputElement>(fixture, `input[formcontrolname="${name}"]`);
  const button = (fixture: Awaited<ReturnType<typeof render>>, id: string) =>
    one<HTMLButtonElement>(fixture, `[data-testid="${id}"]`);

  it('mostra o perfil; email somente leitura; salvar só depois de alterar', async () => {
    const fixture = await render();
    expect(input(fixture, 'name').value).toBe('Ana Souza');
    expect(input(fixture, 'username').value).toBe('Ana.Souza');
    const email = one<HTMLInputElement>(fixture, '[data-testid="email"]');
    expect(email.value).toBe('ana@x.com');
    expect(email.disabled).toBe(true);
    expect(button(fixture, 'save-profile').disabled).toBe(true);
  });

  it('CA-AUTH-13: salva nome e username normalizados', async () => {
    auth.updateProfile.mockReturnValue(of({ ...USER, name: 'Ana Maria Souza' }));
    const fixture = await render();
    await type(fixture, input(fixture, 'name'), ' Ana  Maria Souza ');
    button(fixture, 'save-profile').click();
    expect(auth.updateProfile).toHaveBeenCalledWith({
      name: 'Ana Maria Souza',
      username: 'Ana.Souza',
    });
    expect(snackBar.open).toHaveBeenCalledWith('Perfil atualizado.', 'Fechar', expect.anything());
  });

  it('nome de uma palavra bloqueia; username em uso aparece no campo', async () => {
    const fixture = await render();
    await type(fixture, input(fixture, 'name'), 'Ana');
    expect(button(fixture, 'save-profile').disabled).toBe(true);
    await type(fixture, input(fixture, 'name'), 'Ana Souza');
    await type(fixture, input(fixture, 'username'), 'outro');
    auth.updateProfile.mockReturnValue(throwError(() => apiError('USERNAME_TAKEN')));
    button(fixture, 'save-profile').click();
    fixture.detectChanges();
    expect(text(fixture)).toContain('Este username já está em uso.');
  });

  it('CA-AUTH-12: troca a senha com checklist; senha atual errada aparece no campo', async () => {
    const fixture = await render();
    expect(button(fixture, 'change-password').disabled).toBe(true);
    await type(fixture, input(fixture, 'current'), 'antiga1!');
    await type(fixture, input(fixture, 'password'), 'nova123!@');
    await type(fixture, input(fixture, 'confirm'), 'nova123!@');
    expect(fixture.nativeElement.querySelectorAll('app-password-checklist li.met')).toHaveLength(4);

    auth.changePassword.mockReturnValueOnce(throwError(() => apiError('INVALID_CURRENT_PASSWORD')));
    button(fixture, 'change-password').click();
    fixture.detectChanges();
    expect(text(fixture)).toContain('Senha atual incorreta.');

    auth.changePassword.mockReturnValueOnce(of(undefined));
    await type(fixture, input(fixture, 'current'), 'antiga1!');
    button(fixture, 'change-password').click();
    expect(auth.changePassword).toHaveBeenLastCalledWith({
      current_password: 'antiga1!',
      new_password: 'nova123!@',
    });
    expect(snackBar.open).toHaveBeenCalledWith(
      'Senha alterada. As outras sessões foram encerradas.',
      'Fechar',
      expect.anything(),
    );
    expect(input(fixture, 'current').value).toBe('');
  });

  it('CA-AUTH-14: excluir conta abre a confirmação e, se confirmada, vai ao login', async () => {
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    dialog.open.mockReturnValue({ afterClosed: () => of(true) });
    const fixture = await render();
    button(fixture, 'delete-account').click();
    expect(dialog.open).toHaveBeenCalledWith(DeleteAccountDialog, expect.anything());
    expect(navigate).toHaveBeenCalledWith('/login');
  });

  it('excluir conta cancelado não faz nada', async () => {
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl');
    dialog.open.mockReturnValue({ afterClosed: () => of(undefined) });
    const fixture = await render();
    button(fixture, 'delete-account').click();
    expect(navigate).not.toHaveBeenCalled();
  });
});

describe('DeleteAccountDialog', () => {
  const auth = { deleteAccount: vi.fn() };
  const close = vi.fn();

  beforeEach(() => {
    vi.resetAllMocks();
    TestBed.configureTestingModule({
      providers: [
        { provide: AuthService, useValue: auth },
        { provide: MatDialogRef, useValue: { close } },
      ],
    });
  });

  async function render() {
    const fixture = TestBed.createComponent(DeleteAccountDialog);
    fixture.detectChanges();
    await fixture.whenStable();
    return fixture;
  }

  it('avisa que é irreversível e exige a senha', async () => {
    const fixture = await render();
    expect(text(fixture)).toContain('irreversível');
    expect(one<HTMLButtonElement>(fixture, '[data-testid="confirm-delete"]').disabled).toBe(true);
  });

  it('senha errada aparece no campo; certa fecha com sucesso', async () => {
    const fixture = await render();
    const password = one<HTMLInputElement>(fixture, 'input[formcontrolname="password"]');
    const confirm = () => one<HTMLButtonElement>(fixture, '[data-testid="confirm-delete"]');

    auth.deleteAccount.mockReturnValueOnce(throwError(() => apiError('INVALID_CURRENT_PASSWORD')));
    await type(fixture, password, 'errada');
    confirm().click();
    fixture.detectChanges();
    expect(text(fixture)).toContain('Senha atual incorreta.');
    expect(close).not.toHaveBeenCalled();

    auth.deleteAccount.mockReturnValueOnce(of(undefined));
    await type(fixture, password, 'certa');
    confirm().click();
    expect(auth.deleteAccount).toHaveBeenLastCalledWith('certa');
    expect(close).toHaveBeenCalledWith(true);
  });
});
