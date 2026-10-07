import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { TuiButton, TuiError, TuiIcon, TuiInput } from '@taiga-ui/core';
import { TuiPassword } from '@taiga-ui/kit';
import { ApiError } from '../../core/api/api-error';
import { AuthService } from '../../core/auth/auth.service';
import { injectDialog } from '../../shared/ui/dialog';

/** Exclusão da conta (auth.md §8.3): senha atual + confirmação explícita; fecha com `true`. */
@Component({
  selector: 'app-delete-account-dialog',
  imports: [ReactiveFormsModule, TuiButton, TuiInput, TuiError, TuiIcon, TuiPassword],
  template: `
    <h2 class="dialog-title">Excluir conta</h2>
    <form [formGroup]="form" (ngSubmit)="submit()" novalidate>
      <div class="dialog-content">
        <p class="warning">
          Esta ação é <strong>irreversível</strong>. Sua conta e todos os seus dados — categorias,
          métodos, cartões, faturas, lançamentos, recorrências e meses fechados — serão apagados
          definitivamente.
        </p>
        @if (error(); as message) {
          <p class="inline-error" role="alert">{{ message }}</p>
        }
        <div class="field full-width">
          <tui-textfield>
            <label tuiLabel>Senha atual</label>
            <input
              tuiInput
              type="password"
              formControlName="password"
              autocomplete="current-password"
            />
            <tui-icon tuiPassword />
          </tui-textfield>
          @if (form.controls.password.hasError('wrong')) {
            <tui-error error="Senha atual incorreta." />
          }
        </div>
      </div>
      <footer class="dialog-actions">
        <button tuiButton appearance="flat" type="button" (click)="ref.close()">Cancelar</button>
        <button
          tuiButton
          appearance="primary-destructive"
          type="submit"
          data-testid="confirm-delete"
          [disabled]="submitting() || form.invalid"
        >
          Excluir definitivamente
        </button>
      </footer>
    </form>
  `,
  styles: `
    .warning {
      margin-top: 0;
    }
  `,
})
export class DeleteAccountDialog {
  protected readonly ref = injectDialog<undefined, boolean>();
  private readonly auth = inject(AuthService);
  protected readonly submitting = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly form = inject(FormBuilder).nonNullable.group({
    password: ['', Validators.required],
  });

  protected submit(): void {
    if (this.form.invalid) return;
    this.submitting.set(true);
    this.error.set(null);
    this.auth.deleteAccount(this.form.getRawValue().password).subscribe({
      next: () => this.ref.close(true),
      error: (error: unknown) => {
        this.submitting.set(false);
        if (error instanceof ApiError && error.code === 'INVALID_CURRENT_PASSWORD') {
          this.form.controls.password.setErrors({ wrong: true });
          this.form.controls.password.markAsTouched();
        } else {
          this.error.set(error instanceof ApiError ? error.message : 'Não foi possível excluir.');
        }
      },
    });
  }
}
