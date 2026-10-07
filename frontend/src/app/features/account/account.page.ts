import { Component, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButton } from '@angular/material/button';
import { ErrorStateMatcher } from '@angular/material/core';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInput } from '@angular/material/input';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Router } from '@angular/router';
import { ApiError } from '../../core/api/api-error';
import { AuthService } from '../../core/auth/auth.service';
import {
  fullName,
  matchFields,
  normalizeName,
  strongPassword,
  usernameFormat,
} from '../../shared/forms/auth-validators';
import { mismatchMatcher } from '../auth/mismatch-matcher';
import { PasswordChecklist } from '../auth/password-checklist';
import { DeleteAccountDialog } from './delete-account-dialog';

/** Minha conta (auth.md §8): perfil, trocar senha e excluir conta. */
@Component({
  selector: 'app-account-page',
  imports: [ReactiveFormsModule, MatFormFieldModule, MatInput, MatButton, PasswordChecklist],
  providers: [{ provide: ErrorStateMatcher, useValue: mismatchMatcher }],
  template: `
    <h1>Minha conta</h1>

    <section class="list-card section" aria-labelledby="profile-title">
      <h2 id="profile-title">Perfil</h2>
      <form [formGroup]="profile" (ngSubmit)="saveProfile()" novalidate>
        <mat-form-field class="full-width" subscriptSizing="dynamic">
          <mat-label>Nome completo</mat-label>
          <input matInput formControlName="name" required autocomplete="name" maxlength="150" />
          @if (profile.controls.name.hasError('required')) {
            <mat-error>Informe o nome.</mat-error>
          } @else if (profile.controls.name.hasError('fullName')) {
            <mat-error>Informe nome e sobrenome.</mat-error>
          } @else if (profile.controls.name.hasError('maxlength')) {
            <mat-error>Máximo de 100 caracteres.</mat-error>
          }
        </mat-form-field>
        <mat-form-field class="full-width" subscriptSizing="dynamic">
          <mat-label>Username</mat-label>
          <input
            matInput
            formControlName="username"
            required
            autocomplete="username"
            autocapitalize="none"
            maxlength="30"
          />
          @if (profile.controls.username.hasError('required')) {
            <mat-error>Informe o username.</mat-error>
          } @else if (profile.controls.username.hasError('username')) {
            <mat-error>Use 3 a 30 caracteres: letras sem acento, números, "." e "-".</mat-error>
          } @else if (profile.controls.username.hasError('taken')) {
            <mat-error>Este username já está em uso.</mat-error>
          }
        </mat-form-field>
        <mat-form-field class="full-width" subscriptSizing="dynamic">
          <mat-label>Email</mat-label>
          <input matInput [value]="auth.user()?.email ?? ''" disabled data-testid="email" />
          <mat-hint>O email não pode ser alterado.</mat-hint>
        </mat-form-field>
        <div class="actions">
          <button
            mat-flat-button
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
        <mat-form-field class="full-width" subscriptSizing="dynamic">
          <mat-label>Senha atual</mat-label>
          <input
            matInput
            type="password"
            formControlName="current"
            required
            autocomplete="current-password"
          />
          @if (passwordForm.controls.current.hasError('required')) {
            <mat-error>Informe a senha atual.</mat-error>
          } @else if (passwordForm.controls.current.hasError('wrong')) {
            <mat-error>Senha atual incorreta.</mat-error>
          }
        </mat-form-field>
        <mat-form-field class="full-width" subscriptSizing="dynamic">
          <mat-label>Nova senha</mat-label>
          <input
            matInput
            type="password"
            formControlName="password"
            required
            autocomplete="new-password"
            maxlength="128"
          />
          @if (passwordForm.controls.password.hasError('required')) {
            <mat-error>Informe a nova senha.</mat-error>
          } @else if (passwordForm.controls.password.invalid) {
            <mat-error>A senha não atende aos requisitos abaixo.</mat-error>
          }
        </mat-form-field>
        <app-password-checklist [password]="newPassword()" />
        <mat-form-field class="full-width" subscriptSizing="dynamic">
          <mat-label>Confirmar nova senha</mat-label>
          <input
            matInput
            type="password"
            formControlName="confirm"
            required
            autocomplete="new-password"
          />
          @if (passwordForm.controls.confirm.hasError('required')) {
            <mat-error>Confirme a nova senha.</mat-error>
          } @else if (passwordForm.hasError('mismatch')) {
            <mat-error>As senhas não conferem.</mat-error>
          }
        </mat-form-field>
        <p class="note">Ao trocar a senha, suas sessões em outros dispositivos serão encerradas.</p>
        <div class="actions">
          <button
            mat-flat-button
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
      <p class="note">
        Apaga definitivamente a sua conta e todos os seus dados. Esta ação não pode ser desfeita.
      </p>
      <div class="actions">
        <button
          mat-stroked-button
          class="destructive-outline"
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
      font: var(--mat-sys-title-medium);
    }
    .full-width {
      width: 100%;
      margin-bottom: 0.75rem;
    }
    .actions {
      display: flex;
      justify-content: flex-end;
    }
    .note {
      margin: 0 0 1rem;
      font: var(--mat-sys-body-small);
      color: var(--mat-sys-on-surface-variant);
    }
    .danger h2 {
      color: var(--mat-sys-error);
    }
    .destructive-outline {
      --mat-button-outlined-label-text-color: var(--mat-sys-error);
      --mat-button-outlined-outline-color: var(--mat-sys-error);
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
  private readonly snackBar = inject(MatSnackBar);
  private readonly dialog = inject(MatDialog);
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

  protected saveProfile(): void {
    if (this.profile.invalid) return;
    const { name, username } = this.profile.getRawValue();
    this.savingProfile.set(true);
    this.auth.updateProfile({ name: normalizeName(name), username: username.trim() }).subscribe({
      next: (user) => {
        this.savingProfile.set(false);
        this.profile.reset({ name: user.name, username: user.username });
        this.snackBar.open('Perfil atualizado.', 'Fechar', { duration: 4000 });
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
        this.snackBar.open('Senha alterada. As outras sessões foram encerradas.', 'Fechar', {
          duration: 6000,
        });
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
    this.dialog
      .open<DeleteAccountDialog, void, boolean>(DeleteAccountDialog, { width: '28rem' })
      .afterClosed()
      .subscribe((deleted) => {
        if (!deleted) return;
        this.snackBar.open('Conta excluída.', 'Fechar', { duration: 6000 });
        void this.router.navigateByUrl('/login');
      });
  }

  private showError(error: unknown): void {
    const message = error instanceof ApiError ? error.message : 'Não foi possível salvar.';
    this.snackBar.open(message, 'Fechar', { duration: 6000 });
  }
}
