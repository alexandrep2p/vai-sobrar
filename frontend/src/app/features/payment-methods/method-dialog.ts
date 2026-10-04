import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { MatButton } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInput } from '@angular/material/input';
import type { PaymentMethod } from '../../core/api/models';
import { CatalogService } from '../../core/data/catalog.service';
import { trimmedLength } from '../../shared/forms/validators';

/** Criação (método comum) e edição (método personalizado) de método de pagamento. */
@Component({
  selector: 'app-method-dialog',
  imports: [ReactiveFormsModule, MatDialogModule, MatFormFieldModule, MatInput, MatButton],
  template: `
    <h2 mat-dialog-title>{{ method ? 'Editar método' : 'Novo método' }}</h2>
    <form [formGroup]="form" (ngSubmit)="save()">
      <mat-dialog-content>
        <mat-form-field class="full-width">
          <mat-label>Nome</mat-label>
          <input matInput formControlName="name" maxlength="100" autocomplete="off" />
          @if (form.controls.name.hasError('required')) {
            <mat-error>Informe o nome.</mat-error>
          }
        </mat-form-field>
      </mat-dialog-content>
      <mat-dialog-actions align="end">
        <button mat-button type="button" mat-dialog-close>Cancelar</button>
        <button mat-flat-button type="submit" [disabled]="submitting()">Salvar</button>
      </mat-dialog-actions>
    </form>
  `,
})
export class MethodDialog {
  protected readonly method = inject<PaymentMethod | null>(MAT_DIALOG_DATA, { optional: true });
  private readonly ref = inject(MatDialogRef<MethodDialog, boolean>);
  private readonly catalog = inject(CatalogService);
  protected readonly submitting = signal(false);

  protected readonly form = inject(FormBuilder).nonNullable.group({
    name: [this.method?.name ?? '', trimmedLength(100)],
  });

  protected save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const body = { name: this.form.getRawValue().name.trim() };
    this.submitting.set(true);
    const request = this.method
      ? this.catalog.updatePaymentMethod(this.method.id, body)
      : this.catalog.createPaymentMethod(body);
    request.subscribe({
      next: () => this.ref.close(true),
      error: () => this.submitting.set(false),
    });
  }
}
