import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInput } from '@angular/material/input';
import { TuiButton } from '@taiga-ui/core';
import type { PaymentMethod } from '../../core/api/models';
import { CatalogService } from '../../core/data/catalog.service';
import { trimmedLength } from '../../shared/forms/validators';
import { injectDialog } from '../../shared/ui/dialog';

/** Criação (método comum) e edição (método personalizado) de método de pagamento. */
@Component({
  selector: 'app-method-dialog',
  imports: [ReactiveFormsModule, MatFormFieldModule, MatInput, TuiButton],
  template: `
    <h2 class="dialog-title">{{ method ? 'Editar método' : 'Novo método' }}</h2>
    <form [formGroup]="form" (ngSubmit)="save()">
      <div class="dialog-content">
        <mat-form-field class="full-width">
          <mat-label>Nome</mat-label>
          <input matInput formControlName="name" maxlength="100" autocomplete="off" />
          @if (form.controls.name.hasError('required')) {
            <mat-error>Informe o nome.</mat-error>
          }
        </mat-form-field>
      </div>
      <footer class="dialog-actions">
        <button tuiButton appearance="flat" type="button" (click)="ref.close()">Cancelar</button>
        <button tuiButton type="submit" [disabled]="submitting() || form.invalid">Salvar</button>
      </footer>
    </form>
  `,
})
export class MethodDialog {
  protected readonly ref = injectDialog<PaymentMethod | null, boolean>();
  protected readonly method = this.ref.data ?? null;
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
