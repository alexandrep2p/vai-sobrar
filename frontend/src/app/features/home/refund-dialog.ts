import { Component, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButton } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInput } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import type { RefundInput, RefundSummary } from '../../core/api/models';
import { Clock } from '../../core/clock';
import { LedgerService } from '../../core/data/ledger.service';
import { centsToInput, formatCents, parseCents } from '../../shared/format/money';
import { positiveMoney } from '../../shared/forms/validators';
import {
  PARTIALLY_REFUNDED_LABEL,
  REFUNDED_LABEL,
  refundStrategyLabel,
  type RefundStrategy,
} from '../../shared/labels/labels';

export interface RefundDialogData {
  description: string;
  /** Compra à vista (ou ocorrência de cartão): alvo é o lançamento. */
  transactionId?: string;
  /** Compra parcelada: alvo é o plano, e a estratégia distribui o crédito. */
  planId?: string;
}

/** Estorno total ou parcial de compra de cartão (refunds.md). Limites são validados pelo backend. */
@Component({
  selector: 'app-refund-dialog',
  imports: [
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInput,
    MatSelectModule,
    MatButton,
  ],
  template: `
    <h2 mat-dialog-title>Estornar compra</h2>
    <form [formGroup]="form" (ngSubmit)="save()">
      <mat-dialog-content>
        <p class="hint-text">{{ data.description }}</p>
        @if (summary(); as s) {
          <p data-testid="refundable">
            Saldo estornável: <strong>{{ money(s.refundable_amount) }}</strong> de
            {{ money(s.original_amount) }}
            @if (statusLabel(s); as label) {
              <span class="chip warn" data-testid="refund-status">{{ label }}</span>
            }
          </p>
        }
        <mat-form-field class="full-width">
          <mat-label>Valor do estorno (R$)</mat-label>
          <input matInput formControlName="amount" inputmode="decimal" />
          @if (form.controls.amount.invalid) {
            <mat-error>Informe um valor maior que zero.</mat-error>
          }
        </mat-form-field>
        <mat-form-field class="full-width">
          <mat-label>Data do estorno</mat-label>
          <input matInput type="date" formControlName="refund_date" />
          @if (form.controls.refund_date.invalid) {
            <mat-error>Informe a data.</mat-error>
          }
        </mat-form-field>
        @if (data.planId) {
          <mat-form-field class="full-width">
            <mat-label>Estratégia</mat-label>
            <mat-select formControlName="strategy">
              @for (strategy of strategies; track strategy) {
                <mat-option [value]="strategy">{{ strategyLabel(strategy) }}</mat-option>
              }
            </mat-select>
          </mat-form-field>
        }
      </mat-dialog-content>
      <mat-dialog-actions align="end">
        <button mat-button type="button" mat-dialog-close>Cancelar</button>
        <button mat-flat-button type="submit" [disabled]="submitting()">Estornar</button>
      </mat-dialog-actions>
    </form>
  `,
})
export class RefundDialog implements OnInit {
  protected readonly data = inject<RefundDialogData>(MAT_DIALOG_DATA);
  private readonly ref = inject(MatDialogRef<RefundDialog, boolean>);
  private readonly ledger = inject(LedgerService);

  protected readonly strategies: RefundStrategy[] = [
    'FIRST_INSTALLMENTS',
    'LAST_INSTALLMENTS',
    'PROPORTIONAL',
  ];
  protected readonly strategyLabel = refundStrategyLabel;
  protected readonly money = formatCents;
  protected readonly summary = signal<RefundSummary | null>(null);
  protected readonly submitting = signal(false);

  protected readonly form = inject(FormBuilder).nonNullable.group({
    amount: ['', positiveMoney],
    refund_date: [inject(Clock).today(), Validators.required],
    strategy: ['FIRST_INSTALLMENTS' as RefundStrategy],
  });

  ngOnInit(): void {
    const request = this.data.planId
      ? this.ledger.planRefunds(this.data.planId)
      : this.ledger.transactionRefunds(this.data.transactionId as string);
    request.subscribe((summary) => {
      this.summary.set(summary);
      // Sugestão: estorno total do que ainda pode ser estornado.
      this.form.controls.amount.setValue(centsToInput(summary.refundable_amount));
    });
  }

  protected statusLabel(summary: RefundSummary): string | null {
    if (summary.refund_status === 'FULLY_REFUNDED') return REFUNDED_LABEL;
    if (summary.refund_status === 'PARTIALLY_REFUNDED') return PARTIALLY_REFUNDED_LABEL;
    return null;
  }

  protected save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const v = this.form.getRawValue();
    const body: RefundInput = {
      amount: parseCents(v.amount) as number,
      refund_date: v.refund_date,
      ...(this.data.planId
        ? { installment_plan_id: this.data.planId, strategy: v.strategy }
        : { transaction_id: this.data.transactionId as string }),
    };
    this.submitting.set(true);
    this.ledger.createRefund(body).subscribe({
      next: () => this.ref.close(true),
      error: () => this.submitting.set(false),
    });
  }
}
