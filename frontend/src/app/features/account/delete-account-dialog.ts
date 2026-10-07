import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButton } from '@angular/material/button';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInput } from '@angular/material/input';
import { ApiError } from '../../core/api/api-error';
import { AuthService } from '../../core/auth/auth.service';

/** Exclusão da conta (auth.md §8.3): senha atual + confirmação explícita; fecha com `true`. */
@Component({
  selector: 'app-delete-account-dialog',
  imports: [ReactiveFormsModule, MatDialogModule, MatFormFieldModule, MatInput, MatButton],
  template: `
    <h2 mat-dialog-title>Excluir conta</h2>
    <form [formGroup]="form" (ngSubmit)="submit()" novalidate>
      <mat-dialog-content>
        <p class="warning">
          Esta ação é <strong>irreversível</strong>. Sua conta e todos os seus dados — categorias,
          métodos, cartões, faturas, lançamentos, recorrências e meses fechados — serão apagados
          definitivamente.
        </p>
        @if (error(); as message) {
          <p class="form-error" role="alert">{{ message }}</p>
        }
        <mat-form-field class="full-width">
          <mat-label>Senha atual</mat-label>
          <input
            matInput
            type="password"
            formControlName="password"
            autocomplete="current-password"
          />
          @if (form.controls.password.hasError('required')) {
            <mat-error>Informe a senha atual.</mat-error>
          } @else if (form.controls.password.hasError('wrong')) {
            <mat-error>Senha atual incorreta.</mat-error>
          }
        </mat-form-field>
      </mat-dialog-content>
      <mat-dialog-actions align="end">
        <button mat-button type="button" mat-dialog-close>Cancelar</button>
        <button
          mat-flat-button
          class="destructive"
          type="submit"
          data-testid="confirm-delete"
          [disabled]="submitting() || form.invalid"
        >
          Excluir definitivamente
        </button>
      </mat-dialog-actions>
    </form>
  `,
  styles: `
    .warning {
      margin-top: 0;
    }
    .form-error {
      padding: 0.75rem;
      border-radius: var(--mat-sys-corner-small);
      background: var(--mat-sys-error-container);
      color: var(--mat-sys-on-error-container);
    }
  `,
})
export class DeleteAccountDialog {
  private readonly ref = inject(MatDialogRef<DeleteAccountDialog, boolean>);
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
