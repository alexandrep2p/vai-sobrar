import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { TuiButton, TuiError, TuiInput } from '@taiga-ui/core';
import type { PaymentMethod } from '../../core/api/models';
import { CatalogService } from '../../core/data/catalog.service';
import { trimmedLength } from '../../shared/forms/validators';
import { injectDialog } from '../../shared/ui/dialog';

/** Criação (método comum) e edição (método personalizado) de método de pagamento. */
@Component({
  selector: 'app-method-dialog',
  imports: [ReactiveFormsModule, TuiButton, TuiInput, TuiError],
  template: `
    <h2 class="dialog-title">{{ method ? 'Editar método' : 'Novo método' }}</h2>
    <form [formGroup]="form" (ngSubmit)="save()">
      <div class="dialog-content">
        <div class="field full-width">
          <tui-textfield>
            <label tuiLabel>Nome</label>
            <input tuiInput formControlName="name" maxlength="100" autocomplete="off" />
          </tui-textfield>
          @if (form.controls.name.touched && form.controls.name.hasError('required')) {
            <tui-error error="Informe o nome." />
          }
        </div>
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
