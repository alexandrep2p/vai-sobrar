import { Component, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { AbstractControl, FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { TuiButton, TuiError, TuiIcon, TuiInput, TuiNotificationService } from '@taiga-ui/core';
import { TuiPassword } from '@taiga-ui/kit';
import { ApiError } from '../../core/api/api-error';
import { AuthService } from '../../core/auth/auth.service';
import {
  fullName,
  matchFields,
  normalizeName,
  strongPassword,
  usernameFormat,
} from '../../shared/forms/auth-validators';
import { AppDialog } from '../../shared/ui/dialog';
import { PasswordChecklist } from '../auth/password-checklist';
import { DeleteAccountDialog } from './delete-account-dialog';

/** Minha conta (auth.md §8): perfil, trocar senha e excluir conta. */
@Component({
  selector: 'app-account-page',
  imports: [
    ReactiveFormsModule,
    TuiButton,
    TuiInput,
    TuiError,
    TuiIcon,
    TuiPassword,
    PasswordChecklist,
  ],
  template: `
    <h1>Minha conta</h1>

    <section class="list-card section" aria-labelledby="profile-title">
      <h2 id="profile-title">Perfil</h2>
      <form [formGroup]="profile" (ngSubmit)="saveProfile()" novalidate>
        <div class="field">
          <tui-textfield>
            <label tuiLabel>Nome completo</label>
            <input tuiInput formControlName="name" autocomplete="name" maxlength="150" />
          </tui-textfield>
          @if (show(profile.controls.name); as c) {
            @if (c.hasError('required')) {
              <tui-error error="Informe o nome." />
            } @else if (c.hasError('fullName')) {
              <tui-error error="Informe nome e sobrenome." />
            } @else if (c.hasError('maxlength')) {
              <tui-error error="Máximo de 100 caracteres." />
            }
          }
        </div>
        <div class="field">
          <tui-textfield>
            <label tuiLabel>Username</label>
            <input
              tuiInput
              formControlName="username"
              autocomplete="username"
              autocapitalize="none"
              maxlength="30"
            />
          </tui-textfield>
          @if (show(profile.controls.username); as c) {
            @if (c.hasError('required')) {
              <tui-error error="Informe o username." />
            } @else if (c.hasError('username')) {
              <tui-error error='Use 3 a 30 caracteres: letras sem acento, números, "." e "-".' />
            } @else if (c.hasError('taken')) {
              <tui-error error="Este username já está em uso." />
            }
          }
        </div>
        <div class="field">
          <tui-textfield>
            <label tuiLabel>Email</label>
            <input
              tuiInput
              [value]="auth.user()?.email ?? ''"
              [readonly]="true"
              data-testid="email"
            />
          </tui-textfield>
          <p class="field-hint">O email não pode ser alterado.</p>
        </div>
        <div class="actions">
          <button
            tuiButton
            type="submit"
            data-testid="save-profile"
            [disabled]="savingProfile() || profile.invalid || profile.pristine"
          >
            Salvar perfil
          </button>
        </div>
      </form>
    </section>

    <section class="list-card section" aria-labelledby="password-title">
      <h2 id="password-title">Trocar senha</h2>
      <form [formGroup]="passwordForm" (ngSubmit)="changePassword()" novalidate>
        <div class="field">
          <tui-textfield>
            <label tuiLabel>Senha atual</label>
            <input
              tuiInput
              type="password"
              formControlName="current"
              autocomplete="current-password"
            />
            <tui-icon tuiPassword />
          </tui-textfield>
          @if (show(passwordForm.controls.current); as c) {
            @if (c.hasError('required')) {
              <tui-error error="Informe a senha atual." />
            } @else if (c.hasError('wrong')) {
              <tui-error error="Senha atual incorreta." />
            }
          }
        </div>
        <div class="field">
          <tui-textfield>
            <label tuiLabel>Nova senha</label>
            <input
              tuiInput
              type="password"
              formControlName="password"
              autocomplete="new-password"
              maxlength="128"
            />
            <tui-icon tuiPassword />
          </tui-textfield>
          @if (show(passwordForm.controls.password); as c) {
            @if (c.hasError('required')) {
              <tui-error error="Informe a nova senha." />
            } @else {
              <tui-error error="A senha não atende aos requisitos abaixo." />
            }
          }
        </div>
        <app-password-checklist [password]="newPassword()" />
        <div class="field">
          <tui-textfield>
            <label tuiLabel>Confirmar nova senha</label>
            <input tuiInput type="password" formControlName="confirm" autocomplete="new-password" />
          </tui-textfield>
          @if (passwordForm.controls.confirm.touched) {
            @if (passwordForm.controls.confirm.hasError('required')) {
              <tui-error error="Confirme a nova senha." />
            } @else if (passwordForm.hasError('mismatch')) {
              <tui-error error="As senhas não conferem." />
            }
          }
        </div>
        <p class="hint-text">
          Ao trocar a senha, suas sessões em outros dispositivos serão encerradas.
        </p>
        <div class="actions">
          <button
            tuiButton
            type="submit"
            data-testid="change-password"
            [disabled]="savingPassword() || passwordForm.invalid"
          >
            Trocar senha
          </button>
        </div>
      </form>
    </section>

    <section class="list-card section danger" aria-labelledby="delete-title">
      <h2 id="delete-title">Excluir conta</h2>
      <p class="hint-text">
        Apaga definitivamente a sua conta e todos os seus dados. Esta ação não pode ser desfeita.
      </p>
      <div class="actions">
        <button
          tuiButton
          appearance="secondary-destructive"
          type="button"
          data-testid="delete-account"
          (click)="deleteAccount()"
        >
          Excluir conta
        </button>
      </div>
    </section>
  `,
  styles: `
    :host {
      display: block;
      max-width: 40rem;
    }
    .section {
      margin-bottom: 1rem;
      padding: 1rem;
    }
    h2 {
      margin: 0 0 1rem;
      font: var(--tui-typography-heading-h6);
    }
    .actions {
      display: flex;
      justify-content: flex-end;
    }
    .danger h2 {
      color: var(--tui-text-negative);
    }
    @media (min-width: 768px) {
      .section {
        padding: 1.25rem 1.5rem;
      }
    }
  `,
})
export class AccountPage {
  protected readonly auth = inject(AuthService);
  private readonly notifications = inject(TuiNotificationService);
  private readonly dialog = inject(AppDialog);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder).nonNullable;

  protected readonly savingProfile = signal(false);
  protected readonly savingPassword = signal(false);

  protected readonly profile = this.fb.group({
    name: [this.auth.user()?.name ?? '', fullName],
    username: [this.auth.user()?.username ?? '', usernameFormat],
  });

  protected readonly passwordForm = this.fb.group(
    {
      current: ['', Validators.required],
      password: ['', strongPassword],
      confirm: ['', Validators.required],
    },
    { validators: matchFields('password', 'confirm') },
  );

  protected readonly newPassword = toSignal(this.passwordForm.controls.password.valueChanges, {
    initialValue: '',
  });

  /** O campo, se já tocado e inválido (para exibir o erro). */
  protected show(control: AbstractControl): AbstractControl | null {
    return control.touched && control.invalid ? control : null;
  }

  protected saveProfile(): void {
    if (this.profile.invalid) return;
    const { name, username } = this.profile.getRawValue();
    this.savingProfile.set(true);
    this.auth.updateProfile({ name: normalizeName(name), username: username.trim() }).subscribe({
      next: (user) => {
        this.savingProfile.set(false);
        this.profile.reset({ name: user.name, username: user.username });
        this.notify('Perfil atualizado.');
      },
      error: (error: unknown) => {
        this.savingProfile.set(false);
        if (error instanceof ApiError && error.code === 'USERNAME_TAKEN') {
          this.profile.controls.username.setErrors({ taken: true });
          this.profile.controls.username.markAsTouched();
        } else {
          this.showError(error);
        }
      },
    });
  }

  protected changePassword(): void {
    if (this.passwordForm.invalid) return;
    const { current, password } = this.passwordForm.getRawValue();
    this.savingPassword.set(true);
    this.auth.changePassword({ current_password: current, new_password: password }).subscribe({
      next: () => {
        this.savingPassword.set(false);
        this.passwordForm.reset();
        this.notify('Senha alterada. As outras sessões foram encerradas.');
      },
      error: (error: unknown) => {
        this.savingPassword.set(false);
        if (error instanceof ApiError && error.code === 'INVALID_CURRENT_PASSWORD') {
          this.passwordForm.controls.current.setErrors({ wrong: true });
          this.passwordForm.controls.current.markAsTouched();
        } else {
          this.showError(error);
        }
      },
    });
  }

  protected deleteAccount(): void {
    this.dialog.open<boolean>(DeleteAccountDialog).subscribe((deleted) => {
      if (!deleted) return;
      this.notify('Conta excluída.');
      void this.router.navigateByUrl('/login');
    });
  }

  private notify(message: string): void {
    this.notifications.open(message, { appearance: 'positive', autoClose: 6000 }).subscribe();
  }

  private showError(error: unknown): void {
    const message = error instanceof ApiError ? error.message : 'Não foi possível salvar.';
    this.notifications.open(message, { appearance: 'negative', autoClose: 6000 }).subscribe();
  }
}
