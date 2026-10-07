import { Component, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButton, MatIconButton } from '@angular/material/button';
import { ErrorStateMatcher } from '@angular/material/core';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIcon } from '@angular/material/icon';
import { MatInput } from '@angular/material/input';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Router, RouterLink } from '@angular/router';
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
import { mismatchMatcher } from './mismatch-matcher';

/** Cadastro (auth.md §4–§5): sem sessão; ao concluir, vai para o login com o email preenchido. */
@Component({
  selector: 'app-register-page',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    MatFormFieldModule,
    MatInput,
    MatButton,
    MatIconButton,
    MatIcon,
    PasswordChecklist,
  ],
  providers: [{ provide: ErrorStateMatcher, useValue: mismatchMatcher }],
  template: `
    <main class="auth-card">
      <p class="brand">Vai Sobrar</p>
      <h1>Criar conta</h1>
      @if (error(); as message) {
        <p class="form-error" role="alert" data-testid="form-error">{{ message }}</p>
      }
      <form [formGroup]="form" (ngSubmit)="submit()" novalidate>
        <mat-form-field class="full-width" subscriptSizing="dynamic">
          <mat-label>Nome completo</mat-label>
          <input matInput formControlName="name" required autocomplete="name" maxlength="150" />
          @if (form.controls.name.hasError('required')) {
            <mat-error>Informe o nome.</mat-error>
          } @else if (form.controls.name.hasError('fullName')) {
            <mat-error>Informe nome e sobrenome.</mat-error>
          } @else if (form.controls.name.hasError('maxlength')) {
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
          <mat-hint>3 a 30 caracteres: letras sem acento, números, "." e "-".</mat-hint>
          @if (form.controls.username.hasError('required')) {
            <mat-error>Informe o username.</mat-error>
          } @else if (form.controls.username.hasError('username')) {
            <mat-error>Use 3 a 30 caracteres: letras sem acento, números, "." e "-".</mat-error>
          } @else if (form.controls.username.hasError('taken')) {
            <mat-error>Este username já está em uso.</mat-error>
          }
        </mat-form-field>
        <mat-form-field class="full-width" subscriptSizing="dynamic">
          <mat-label>Email</mat-label>
          <input matInput type="email" formControlName="email" autocomplete="email" />
          @if (form.controls.email.hasError('required')) {
            <mat-error>Informe o email.</mat-error>
          } @else if (form.controls.email.hasError('email')) {
            <mat-error>Email inválido.</mat-error>
          } @else if (form.controls.email.hasError('taken')) {
            <mat-error>Já existe uma conta com este email.</mat-error>
          }
        </mat-form-field>
        <mat-form-field class="full-width" subscriptSizing="dynamic">
          <mat-label>Senha</mat-label>
          <input
            matInput
            [type]="showPassword() ? 'text' : 'password'"
            formControlName="password"
            required
            autocomplete="new-password"
            maxlength="128"
          />
          <button
            mat-icon-button
            matSuffix
            type="button"
            (click)="showPassword.set(!showPassword())"
            [attr.aria-label]="showPassword() ? 'Ocultar senha' : 'Mostrar senha'"
          >
            <mat-icon>{{ showPassword() ? 'visibility_off' : 'visibility' }}</mat-icon>
          </button>
          @if (form.controls.password.hasError('required')) {
            <mat-error>Informe a senha.</mat-error>
          } @else if (form.controls.password.invalid) {
            <mat-error>A senha não atende aos requisitos abaixo.</mat-error>
          }
        </mat-form-field>
        <app-password-checklist [password]="password()" />
        <mat-form-field class="full-width" subscriptSizing="dynamic">
          <mat-label>Confirmar senha</mat-label>
          <input
            matInput
            [type]="showPassword() ? 'text' : 'password'"
            formControlName="confirm"
            required
            autocomplete="new-password"
          />
          @if (form.controls.confirm.hasError('required')) {
            <mat-error>Confirme a senha.</mat-error>
          } @else if (form.hasError('mismatch')) {
            <mat-error>As senhas não conferem.</mat-error>
          }
        </mat-form-field>
        <button
          mat-flat-button
          class="submit"
          type="submit"
          [disabled]="submitting() || form.invalid"
        >
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
  private readonly snackBar = inject(MatSnackBar);

  protected readonly submitting = signal(false);
  protected readonly showPassword = signal(false);
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
        this.snackBar.open('Conta criada. Entre com seu email e senha.', 'Fechar', {
          duration: 6000,
        });
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

  private markTaken(control: { setErrors(e: object): void; markAsTouched(): void }): void {
    control.setErrors({ taken: true });
    control.markAsTouched();
  }
}
