import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { TuiButton, TuiError, TuiInput } from '@taiga-ui/core';
import { TuiInputDate } from '@taiga-ui/kit';
import type { InstallmentPlan } from '../../core/api/models';
import { LedgerService } from '../../core/data/ledger.service';
import { formatDate } from '../../shared/format/dates';
import { describeInstallments } from '../../shared/format/installments';
import { centsToInput, formatCents, parseCents } from '../../shared/format/money';
import { ISO_DATE_INPUTS } from '../../shared/forms/iso-dates';
import { MoneyInput } from '../../shared/forms/money-input';
import { positiveMoney } from '../../shared/forms/validators';
import { AppDialog, injectDialog } from '../../shared/ui/dialog';
import { confirmSummary } from '../../shared/ui/summary-dialog';

/**
 * Edição da compra parcelada (installments.md §8, PD-36): valor total, quantidade de parcelas e
 * data da compra. As parcelas são recalculadas pelo backend, que valida se o plano ainda pode
 * mudar (sem parcela em fatura paga, mês fechado ou estorno).
 */
@Component({
  selector: 'app-plan-edit-dialog',
  imports: [TuiInputDate, ReactiveFormsModule, MoneyInput, TuiButton, TuiInput, TuiError],
  providers: [ISO_DATE_INPUTS],
  template: `
    <h2 class="dialog-title">Editar compra parcelada</h2>
    <form [formGroup]="form" (ngSubmit)="save()">
      <div class="dialog-content">
        <p class="hint-text">
          <strong>{{ plan.description }}</strong
          ><br />
          As parcelas serão recalculadas. A edição só é possível enquanto nenhuma parcela estiver em
          fatura paga ou mês fechado e a compra não tiver estorno.
        </p>
        <div class="field full-width">
          <tui-textfield>
            <label tuiLabel>Valor total (R$)</label>
            <input tuiInput appMoneyInput formControlName="amount" data-testid="amount" />
          </tui-textfield>
          @if (form.controls.amount.touched && form.controls.amount.invalid) {
            <tui-error error="Informe um valor maior que zero." />
          }
        </div>
        <div class="form-grid two">
          <div class="field">
            <tui-textfield>
              <label tuiLabel>Parcelas</label>
              <input
                tuiInput
                type="number"
                inputmode="numeric"
                min="2"
                max="120"
                formControlName="installment_count"
                data-testid="count"
              />
            </tui-textfield>
            @if (
              form.controls.installment_count.touched && form.controls.installment_count.invalid
            ) {
              <tui-error error="Informe de 2 a 120." />
            }
          </div>
          <div class="field">
            <tui-textfield>
              <label tuiLabel>Data da compra</label>
              <input tuiInputDate formControlName="purchase_date" data-testid="date" />
              <tui-calendar *tuiDropdown />
            </tui-textfield>
            @if (form.controls.purchase_date.touched && form.controls.purchase_date.invalid) {
              <tui-error error="Informe a data da compra." />
            }
          </div>
        </div>
      </div>
      <footer class="dialog-actions">
        <button tuiButton appearance="flat" type="button" (click)="ref.close()">Cancelar</button>
        <button tuiButton type="submit" [disabled]="submitting() || form.invalid">Salvar</button>
      </footer>
    </form>
  `,
})
export class PlanEditDialog {
  protected readonly ref = injectDialog<InstallmentPlan, boolean>();
  protected readonly plan = this.ref.data;
  private readonly dialog = inject(AppDialog);
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
