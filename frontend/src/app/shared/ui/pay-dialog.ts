import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { TuiButton, TuiDataList, TuiDropdown, TuiError, TuiInput } from '@taiga-ui/core';
import { TuiChevron, TuiSelect } from '@taiga-ui/kit';
import { Clock } from '../../core/clock';
import { nameById } from '../forms/options';
import { injectDialog } from './dialog';

export interface PayDialogData {
  title: string;
  confirmLabel: string;
  /** Texto de apoio (ex.: valor a pagar). */
  message?: string;
  /** Quando informado, exige a escolha do método de pagamento. */
  methods?: { id: string; name: string }[];
}

export interface PayDialogResult {
  paid_at: string;
  payment_method_id?: string;
}

/** Coleta a data do pagamento (e, opcionalmente, o método). Quem abre o diálogo faz a chamada. */
@Component({
  selector: 'app-pay-dialog',
  imports: [
    ReactiveFormsModule,
    TuiButton,
    TuiInput,
    TuiError,
    TuiDataList,
    TuiDropdown,
    TuiChevron,
    TuiSelect,
  ],
  template: `
    <h2 class="dialog-title">{{ data.title }}</h2>
    <form [formGroup]="form" (ngSubmit)="confirm()">
      <div class="dialog-content">
        @if (data.message) {
          <p class="hint-text">{{ data.message }}</p>
        }
        <div class="field full-width">
          <tui-textfield>
            <label tuiLabel>Data do pagamento</label>
            <input tuiInput type="date" formControlName="paid_at" />
          </tui-textfield>
          @if (form.controls.paid_at.touched && form.controls.paid_at.invalid) {
            <tui-error error="Informe a data." />
          }
        </div>
        @if (data.methods) {
          <div class="field full-width">
            <tui-textfield tuiChevron [stringify]="methodName">
              <label tuiLabel>Método de pagamento</label>
              <input
                tuiSelect
                formControlName="payment_method_id"
                data-testid="payment_method_id"
              />
              <tui-data-list *tuiDropdown>
                @for (method of data.methods; track method.id) {
                  <button tuiOption type="button" [value]="method.id">{{ method.name }}</button>
                }
              </tui-data-list>
            </tui-textfield>
            @if (
              form.controls.payment_method_id.touched && form.controls.payment_method_id.invalid
            ) {
              <tui-error error="Escolha o método." />
            }
          </div>
        }
      </div>
      <footer class="dialog-actions">
        <button tuiButton appearance="flat" type="button" (click)="ref.close()">Cancelar</button>
        <button tuiButton type="submit" [disabled]="form.invalid">{{ data.confirmLabel }}</button>
      </footer>
    </form>
  `,
})
export class PayDialog {
  protected readonly ref = injectDialog<PayDialogData, PayDialogResult>();
  protected readonly data = this.ref.data;
  protected readonly methodName = nameById(() => this.data.methods ?? []);

  protected readonly form = inject(FormBuilder).nonNullable.group({
    paid_at: [inject(Clock).today(), Validators.required],
    payment_method_id: ['', this.data.methods ? Validators.required : []],
  });

  protected confirm(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const { paid_at, payment_method_id } = this.form.getRawValue();
    this.ref.close(this.data.methods ? { paid_at, payment_method_id } : { paid_at });
  }
}
