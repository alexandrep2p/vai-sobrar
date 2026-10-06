import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInput } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { TuiButton } from '@taiga-ui/core';
import { Clock } from '../../core/clock';
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
  imports: [ReactiveFormsModule, MatFormFieldModule, MatInput, MatSelectModule, TuiButton],
  template: `
    <h2 class="dialog-title">{{ data.title }}</h2>
    <form [formGroup]="form" (ngSubmit)="confirm()">
      <div class="dialog-content">
        @if (data.message) {
          <p class="hint-text">{{ data.message }}</p>
        }
        <mat-form-field class="full-width">
          <mat-label>Data do pagamento</mat-label>
          <input matInput type="date" formControlName="paid_at" />
          @if (form.controls.paid_at.invalid) {
            <mat-error>Informe a data.</mat-error>
          }
        </mat-form-field>
        @if (data.methods) {
          <mat-form-field class="full-width">
            <mat-label>Método de pagamento</mat-label>
            <mat-select formControlName="payment_method_id">
              @for (method of data.methods; track method.id) {
                <mat-option [value]="method.id">{{ method.name }}</mat-option>
              }
            </mat-select>
            @if (form.controls.payment_method_id.invalid) {
              <mat-error>Escolha o método.</mat-error>
            }
          </mat-form-field>
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
