import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButton } from '@angular/material/button';
import {
  MAT_DIALOG_DATA,
  MatDialog,
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInput } from '@angular/material/input';
import type { InstallmentPlan } from '../../core/api/models';
import { LedgerService } from '../../core/data/ledger.service';
import { formatDate } from '../../shared/format/dates';
import { describeInstallments } from '../../shared/format/installments';
import { centsToInput, formatCents, parseCents } from '../../shared/format/money';
import { MoneyInput } from '../../shared/forms/money-input';
import { positiveMoney } from '../../shared/forms/validators';
import { confirmSummary } from '../../shared/ui/summary-dialog';

/**
 * Edição da compra parcelada (installments.md §8, PD-36): valor total, quantidade de parcelas e
 * data da compra. As parcelas são recalculadas pelo backend, que valida se o plano ainda pode
 * mudar (sem parcela em fatura paga, mês fechado ou estorno).
 */
@Component({
  selector: 'app-plan-edit-dialog',
  imports: [
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInput,
    MoneyInput,
    MatButton,
  ],
  template: `
    <h2 mat-dialog-title>Editar compra parcelada</h2>
    <form [formGroup]="form" (ngSubmit)="save()">
      <mat-dialog-content>
        <p class="hint-text">
          <strong>{{ plan.description }}</strong
          ><br />
          As parcelas serão recalculadas. A edição só é possível enquanto nenhuma parcela estiver em
          fatura paga ou mês fechado e a compra não tiver estorno.
        </p>
        <mat-form-field class="full-width">
          <mat-label>Valor total (R$)</mat-label>
          <input matInput appMoneyInput formControlName="amount" data-testid="amount" />
          @if (form.controls.amount.invalid) {
            <mat-error>Informe um valor maior que zero.</mat-error>
          }
        </mat-form-field>
        <div class="form-grid two">
          <mat-form-field>
            <mat-label>Parcelas</mat-label>
            <input
              matInput
              type="number"
              inputmode="numeric"
              min="2"
              max="120"
              formControlName="installment_count"
              data-testid="count"
            />
            @if (form.controls.installment_count.invalid) {
              <mat-error>Informe de 2 a 120.</mat-error>
            }
          </mat-form-field>
          <mat-form-field>
            <mat-label>Data da compra</mat-label>
            <input matInput type="date" formControlName="purchase_date" data-testid="date" />
            @if (form.controls.purchase_date.invalid) {
              <mat-error>Informe a data da compra.</mat-error>
            }
          </mat-form-field>
        </div>
      </mat-dialog-content>
      <mat-dialog-actions align="end">
        <button mat-button type="button" mat-dialog-close>Cancelar</button>
        <button mat-flat-button type="submit" [disabled]="submitting() || form.invalid">
          Salvar
        </button>
      </mat-dialog-actions>
    </form>
  `,
})
export class PlanEditDialog {
  protected readonly plan = inject<InstallmentPlan>(MAT_DIALOG_DATA);
  private readonly ref = inject(MatDialogRef<PlanEditDialog, boolean>);
  private readonly dialog = inject(MatDialog);
  private readonly ledger = inject(LedgerService);

  protected readonly submitting = signal(false);

  protected readonly form = inject(FormBuilder).nonNullable.group({
    amount: [centsToInput(this.plan.total_amount), positiveMoney],
    installment_count: [
      this.plan.installment_count,
      [Validators.required, Validators.min(2), Validators.max(120)],
    ],
    purchase_date: [this.plan.purchase_date, Validators.required],
  });

  protected save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const v = this.form.getRawValue();
    const total = parseCents(v.amount) as number;
    const count = Number(v.installment_count);
    const plan = this.plan;

    const changes: { total_amount?: number; installment_count?: number; purchase_date?: string } =
      {};
    if (total !== plan.total_amount) changes.total_amount = total;
    if (count !== plan.installment_count) changes.installment_count = count;
    if (v.purchase_date !== plan.purchase_date) changes.purchase_date = v.purchase_date;
    if (Object.keys(changes).length === 0) {
      this.ref.close(false);
      return;
    }

    confirmSummary(this.dialog, {
      title: 'Confirmar alterações da compra',
      rows: [
        { label: 'Compra', value: plan.description },
        {
          label: 'Valor total',
          value: `${formatCents(plan.total_amount)} → ${formatCents(total)}`,
        },
        {
          label: 'Parcelas',
          value: `${describeInstallments(plan.total_amount, plan.installment_count)} → ${describeInstallments(total, count)}`,
        },
        {
          label: 'Data da compra',
          value: `${formatDate(plan.purchase_date)} → ${formatDate(v.purchase_date)}`,
        },
      ],
      confirmLabel: 'Confirmar',
    }).subscribe((confirmed) => {
      if (!confirmed) return;
      this.submitting.set(true);
      this.ledger.updatePlan(plan.id, changes).subscribe({
        next: () => this.ref.close(true),
        error: () => this.submitting.set(false),
      });
    });
  }
}
