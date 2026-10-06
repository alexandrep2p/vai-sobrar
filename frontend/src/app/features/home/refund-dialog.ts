import { Component, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { TuiButton, TuiDataList, TuiDropdown, TuiError, TuiInput } from '@taiga-ui/core';
import { TuiChevron, TuiSelect } from '@taiga-ui/kit';
import type { RefundInput, RefundSummary } from '../../core/api/models';
import { Clock } from '../../core/clock';
import { LedgerService } from '../../core/data/ledger.service';
import { formatDate } from '../../shared/format/dates';
import { centsToInput, formatCents, parseCents } from '../../shared/format/money';
import { positiveMoney } from '../../shared/forms/validators';
import { MoneyInput } from '../../shared/forms/money-input';
import {
  PARTIALLY_REFUNDED_LABEL,
  REFUNDED_LABEL,
  refundStrategyLabel,
  type RefundStrategy,
} from '../../shared/labels/labels';
import { AppDialog, injectDialog } from '../../shared/ui/dialog';
import { confirmSummary } from '../../shared/ui/summary-dialog';

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
    MoneyInput,
    TuiButton,
    TuiInput,
    TuiError,
    TuiDataList,
    TuiDropdown,
    TuiChevron,
    TuiSelect,
  ],
  template: `
    <h2 class="dialog-title">Estornar compra</h2>
    <form [formGroup]="form" (ngSubmit)="save()">
      <div class="dialog-content">
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
        <div class="field full-width">
          <tui-textfield>
            <label tuiLabel>Valor do estorno (R$)</label>
            <input tuiInput appMoneyInput formControlName="amount" />
          </tui-textfield>
          @if (form.controls.amount.touched && form.controls.amount.invalid) {
            <tui-error error="Informe um valor maior que zero." />
          }
        </div>
        <div class="field full-width">
          <tui-textfield>
            <label tuiLabel>Data do estorno</label>
            <input tuiInput type="date" formControlName="refund_date" />
          </tui-textfield>
          @if (form.controls.refund_date.touched && form.controls.refund_date.invalid) {
            <tui-error error="Informe a data." />
          }
        </div>
        @if (data.planId) {
          <div class="field full-width">
            <tui-textfield tuiChevron [stringify]="strategyLabel">
              <label tuiLabel>Estratégia</label>
              <input tuiSelect formControlName="strategy" data-testid="strategy" />
              <tui-data-list *tuiDropdown>
                @for (strategy of strategies; track strategy) {
                  <button tuiOption type="button" [value]="strategy">
                    {{ strategyLabel(strategy) }}
                  </button>
                }
              </tui-data-list>
            </tui-textfield>
          </div>
        }
      </div>
      <footer class="dialog-actions">
        <button tuiButton appearance="flat" type="button" (click)="ref.close()">Cancelar</button>
        <button tuiButton type="submit" [disabled]="submitting() || form.invalid">Estornar</button>
      </footer>
    </form>
  `,
})
export class RefundDialog implements OnInit {
  protected readonly ref = injectDialog<RefundDialogData, boolean>();
  protected readonly data = this.ref.data;
  private readonly dialog = inject(AppDialog);
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
    confirmSummary(this.dialog, {
      title: 'Confirmar estorno',
      rows: [
        { label: 'Compra', value: this.data.description },
        { label: 'Valor do estorno', value: formatCents(body.amount) },
        { label: 'Data do estorno', value: formatDate(body.refund_date) },
        ...(this.data.planId
          ? [{ label: 'Estratégia', value: refundStrategyLabel(v.strategy) }]
          : []),
      ],
      confirmLabel: 'Confirmar',
    }).subscribe((confirmed) => {
      if (confirmed) this.send(body);
    });
  }

  private send(body: RefundInput): void {
    this.submitting.set(true);
    this.ledger.createRefund(body).subscribe({
      next: () => this.ref.close(true),
      error: () => this.submitting.set(false),
    });
  }
}
