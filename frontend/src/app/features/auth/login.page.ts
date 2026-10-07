import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButton, MatIconButton } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIcon } from '@angular/material/icon';
import { MatInput } from '@angular/material/input';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ApiError } from '../../core/api/api-error';
import { safeReturnUrl } from '../../core/auth/auth.guards';
import { AuthService } from '../../core/auth/auth.service';

/** Login por email e senha (auth.md §6). */
@Component({
  selector: 'app-login-page',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    MatFormFieldModule,
    MatInput,
    MatButton,
    MatIconButton,
    MatIcon,
  ],
  template: `
    <main class="auth-card">
      <p class="brand">Vai Sobrar</p>
      <h1>Entrar</h1>
      @if (error(); as message) {
        <p class="form-error" role="alert" data-testid="form-error">{{ message }}</p>
      }
      <form [formGroup]="form" (ngSubmit)="submit()" novalidate>
        <mat-form-field class="full-width">
          <mat-label>Email</mat-label>
          <input matInput type="email" formControlName="email" autocomplete="email" />
          @if (form.controls.email.hasError('required')) {
            <mat-error>Informe o email.</mat-error>
          } @else if (form.controls.email.hasError('email')) {
            <mat-error>Email inválido.</mat-error>
          }
        </mat-form-field>
        <mat-form-field class="full-width">
          <mat-label>Senha</mat-label>
          <input
            matInput
            [type]="showPassword() ? 'text' : 'password'"
            formControlName="password"
            autocomplete="current-password"
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
          }
        </mat-form-field>
        <button
          mat-flat-button
          class="submit"
          type="submit"
          [disabled]="submitting() || form.invalid"
        >
          Entrar
        </button>
      </form>
      <p class="switch">Ainda não tem conta? <a routerLink="/cadastro">Criar conta</a></p>
    </main>
  `,
  styleUrl: './auth-page.css',
})
export class LoginPage {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  protected readonly submitting = signal(false);
  protected readonly showPassword = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly form = inject(FormBuilder).nonNullable.group({
    // Email vindo do cadastro (estado da navegação, nunca pela URL).
    email: [this.initialEmail(), [Validators.required, Validators.email]],
    password: ['', Validators.required],
  });

  protected submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const { email, password } = this.form.getRawValue();
    this.submitting.set(true);
    this.error.set(null);
    this.auth.login({ email: email.trim(), password }).subscribe({
      next: () => {
        const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl');
        void this.router.navigateByUrl(safeReturnUrl(returnUrl));
      },
      error: (error: unknown) => {
        this.submitting.set(false);
        this.error.set(error instanceof ApiError ? error.message : 'Não foi possível entrar.');
      },
    });
  }

  private initialEmail(): string {
    const state = this.router.currentNavigation()?.extras.state ?? history.state;
    const email = (state as { email?: unknown } | null)?.email;
    return typeof email === 'string' ? email : '';
  }
}
