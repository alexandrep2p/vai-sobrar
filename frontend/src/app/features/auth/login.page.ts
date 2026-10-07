import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TuiButton, TuiError, TuiIcon, TuiInput } from '@taiga-ui/core';
import { TuiPassword } from '@taiga-ui/kit';
import { ApiError } from '../../core/api/api-error';
import { safeReturnUrl } from '../../core/auth/auth.guards';
import { AuthService } from '../../core/auth/auth.service';

/** Login por email e senha (auth.md §6). */
@Component({
  selector: 'app-login-page',
  imports: [ReactiveFormsModule, RouterLink, TuiButton, TuiInput, TuiError, TuiIcon, TuiPassword],
  template: `
    <main class="auth-card">
      <p class="brand">Vai Sobrar</p>
      <h1>Entrar</h1>
      @if (error(); as message) {
        <p class="form-error" role="alert" data-testid="form-error">{{ message }}</p>
      }
      <form [formGroup]="form" (ngSubmit)="submit()" novalidate>
        <div class="field">
          <tui-textfield>
            <label tuiLabel>Email</label>
            <input tuiInput type="email" formControlName="email" autocomplete="email" />
          </tui-textfield>
          @if (form.controls.email.touched && form.controls.email.hasError('required')) {
            <tui-error error="Informe o email." />
          } @else if (form.controls.email.touched && form.controls.email.hasError('email')) {
            <tui-error error="Email inválido." />
          }
        </div>
        <div class="field">
          <tui-textfield>
            <label tuiLabel>Senha</label>
            <input
              tuiInput
              type="password"
              formControlName="password"
              autocomplete="current-password"
            />
            <tui-icon tuiPassword />
          </tui-textfield>
          @if (form.controls.password.touched && form.controls.password.hasError('required')) {
            <tui-error error="Informe a senha." />
          }
        </div>
        <button tuiButton class="submit" type="submit" [disabled]="submitting() || form.invalid">
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
