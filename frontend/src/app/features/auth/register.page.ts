import { Component, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { AbstractControl, FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
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
import { PasswordChecklist } from './password-checklist';

/** Cadastro (auth.md §4–§5): sem sessão; ao concluir, vai para o login com o email preenchido. */
@Component({
  selector: 'app-register-page',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    TuiButton,
    TuiInput,
    TuiError,
    TuiIcon,
    TuiPassword,
    PasswordChecklist,
  ],
  template: `
    <main class="auth-card">
      <p class="brand">Vai Sobrar</p>
      <h1>Criar conta</h1>
      @if (error(); as message) {
        <p class="form-error" role="alert" data-testid="form-error">{{ message }}</p>
      }
      <form [formGroup]="form" (ngSubmit)="submit()" novalidate>
        <div class="field">
          <tui-textfield>
            <label tuiLabel>Nome completo</label>
            <input tuiInput formControlName="name" autocomplete="name" maxlength="150" />
          </tui-textfield>
          @if (show(form.controls.name); as c) {
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
          @if (show(form.controls.username); as c) {
            @if (c.hasError('required')) {
              <tui-error error="Informe o username." />
            } @else if (c.hasError('username')) {
              <tui-error [error]="usernameRule" />
            } @else if (c.hasError('taken')) {
              <tui-error error="Este username já está em uso." />
            }
          } @else {
            <p class="field-hint">{{ usernameRule }}</p>
          }
        </div>
        <div class="field">
          <tui-textfield>
            <label tuiLabel>Email</label>
            <input tuiInput type="email" formControlName="email" autocomplete="email" />
          </tui-textfield>
          @if (show(form.controls.email); as c) {
            @if (c.hasError('required')) {
              <tui-error error="Informe o email." />
            } @else if (c.hasError('email')) {
              <tui-error error="Email inválido." />
            } @else if (c.hasError('taken')) {
              <tui-error error="Já existe uma conta com este email." />
            }
          }
        </div>
        <div class="field">
          <tui-textfield>
            <label tuiLabel>Senha</label>
            <input
              tuiInput
              type="password"
              formControlName="password"
              autocomplete="new-password"
              maxlength="128"
            />
            <tui-icon tuiPassword />
          </tui-textfield>
          @if (show(form.controls.password); as c) {
            @if (c.hasError('required')) {
              <tui-error error="Informe a senha." />
            } @else {
              <tui-error error="A senha não atende aos requisitos abaixo." />
            }
          }
        </div>
        <app-password-checklist [password]="password()" />
        <div class="field">
          <tui-textfield>
            <label tuiLabel>Confirmar senha</label>
            <input tuiInput type="password" formControlName="confirm" autocomplete="new-password" />
          </tui-textfield>
          @if (form.controls.confirm.touched) {
            @if (form.controls.confirm.hasError('required')) {
              <tui-error error="Confirme a senha." />
            } @else if (form.hasError('mismatch')) {
              <tui-error error="As senhas não conferem." />
            }
          }
        </div>
        <button tuiButton class="submit" type="submit" [disabled]="submitting() || form.invalid">
          Criar conta
        </button>
      </form>
      <p class="switch">Já tem conta? <a routerLink="/login">Entrar</a></p>
    </main>
  `,
  styleUrl: './auth-page.css',
})
export class RegisterPage {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly notifications = inject(TuiNotificationService);

  protected readonly usernameRule = '3 a 30 caracteres: letras sem acento, números, "." e "-".';
  protected readonly submitting = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly form = inject(FormBuilder).nonNullable.group(
    {
      name: ['', fullName],
      username: ['', usernameFormat],
      email: ['', [Validators.required, Validators.email]],
      password: ['', strongPassword],
      confirm: ['', Validators.required],
    },
    { validators: matchFields('password', 'confirm') },
  );

  protected readonly password = toSignal(this.form.controls.password.valueChanges, {
    initialValue: '',
  });

  /** O campo, se já tocado e inválido (para exibir o erro). */
  protected show(control: AbstractControl): AbstractControl | null {
    return control.touched && control.invalid ? control : null;
  }

  protected submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const { name, username, email, password } = this.form.getRawValue();
    const body = {
      name: normalizeName(name),
      username: username.trim(),
      email: email.trim(),
      password,
    };
    this.submitting.set(true);
    this.error.set(null);
    this.auth.register(body).subscribe({
      next: (user) => {
        this.notifications
          .open('Conta criada. Entre com seu email e senha.', {
            appearance: 'positive',
            autoClose: 6000,
          })
          .subscribe();
        void this.router.navigateByUrl('/login', { state: { email: user.email } });
      },
      error: (error: unknown) => {
        this.submitting.set(false);
        this.showServerError(error);
      },
    });
  }

  private showServerError(error: unknown): void {
    if (error instanceof ApiError && error.code === 'EMAIL_TAKEN') {
      this.markTaken(this.form.controls.email);
    } else if (error instanceof ApiError && error.code === 'USERNAME_TAKEN') {
      this.markTaken(this.form.controls.username);
    } else {
      this.error.set(error instanceof ApiError ? error.message : 'Não foi possível criar a conta.');
    }
  }

  private markTaken(control: AbstractControl): void {
    control.setErrors({ taken: true });
    control.markAsTouched();
  }
}
