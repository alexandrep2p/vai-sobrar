import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { TuiButton } from '@taiga-ui/core';
import type { InstallmentPlan, Transaction } from '../../core/api/models';
import { LedgerService } from '../../core/data/ledger.service';
import { formatDate, formatMonth } from '../../shared/format/dates';
import { formatCents } from '../../shared/format/money';
import { invoiceStatusLabel, transactionStatusLabel } from '../../shared/labels/labels';
import { AppDialog, injectDialog } from '../../shared/ui/dialog';
import { PlanEditDialog } from './plan-edit-dialog';

export interface PurchaseDetailData {
  /** Compra à vista ou lançamento original de um estorno. */
  transactionId?: string;
  /** Compra parcelada (plano). */
  planId?: string;
}

/** Acesso à compra original: dados da compra e, se parcelada, o plano com todas as parcelas. */
@Component({
  selector: 'app-purchase-detail-dialog',
  imports: [TuiButton],
  template: `
    <h2 class="dialog-title">Compra original</h2>
    <div class="dialog-content">
      @if (plan(); as p) {
        <p>
          <strong>{{ p.description }}</strong> · {{ p.category.name }}<br />
          {{ money(p.total_amount) }} em {{ p.installment_count }}x · compra em
          {{ date(p.purchase_date) }}
        </p>
        <div class="list-card">
          @for (i of p.installments; track i.number) {
            <div class="list-row" data-testid="installment-row">
              <div class="grow">
                {{ i.number }}/{{ p.installment_count }} · {{ money(i.amount) }}
                <div class="sub">
                  Fatura de {{ month(i.invoice?.reference_month ?? i.financial_month) }}
                  @if (i.invoice) {
                    · {{ invoiceLabel(i.invoice.status) }}
                  }
                </div>
              </div>
              <span class="chip">{{ statusLabel(i.status) }}</span>
            </div>
          }
        </div>
        @if (!editable()) {
          <p class="hint-text" data-testid="edit-blocked">
            Há parcela em fatura paga: para desfazer a compra, use o estorno.
          </p>
        }
      } @else if (transaction(); as t) {
        <p>
          <strong>{{ t.description }}</strong> · {{ t.category.name }}<br />
          {{ money(t.amount) }} · {{ t.payment_method.name }}
          @if (t.purchase_date) {
            · compra em {{ date(t.purchase_date) }}
          }
        </p>
        @if (t.invoice) {
          <p class="hint-text">
            Fatura de {{ month(t.invoice.reference_month) }} · vence em
            {{ date(t.invoice.due_date) }} · {{ invoiceLabel(t.invoice.status) }}
          </p>
        }
      } @else {
        <p>Carregando…</p>
      }
    </div>
    <footer class="dialog-actions">
      <button tuiButton appearance="flat" (click)="ref.close()">Fechar</button>
      @if (plan()) {
        <button
          tuiButton
          appearance="outline"
          [disabled]="!editable()"
          (click)="editPlan()"
          data-testid="edit-plan"
        >
          Editar compra
        </button>
      }
    </footer>
  `,
})
export class PurchaseDetailDialog implements OnInit {
  protected readonly ref = injectDialog<PurchaseDetailData, boolean>();
  private readonly data = this.ref.data;
  private readonly dialog = inject(AppDialog);
  private readonly ledger = inject(LedgerService);

  protected readonly plan = signal<InstallmentPlan | null>(null);
  protected readonly transaction = signal<Transaction | null>(null);
  protected readonly money = formatCents;
  protected readonly date = formatDate;
  protected readonly month = formatMonth;
  protected readonly invoiceLabel = invoiceStatusLabel;
  protected readonly statusLabel = transactionStatusLabel;

  /** Sem parcela em fatura paga (o backend ainda valida mês fechado e estorno). */
  protected readonly editable = computed(
    () => this.plan()?.installments.every((i) => i.invoice?.status !== 'PAID') ?? false,
  );

  protected editPlan(): void {
    const plan = this.plan();
    if (!plan) return;
    this.dialog.open(PlanEditDialog, plan).subscribe((changed) => changed && this.ref.close(true));
  }

  ngOnInit(): void {
    if (this.data.planId) {
      this.ledger.getPlan(this.data.planId).subscribe((plan) => this.plan.set(plan));
      return;
    }
    this.ledger.getTransaction(this.data.transactionId as string).subscribe((transaction) => {
      if (transaction.installment) {
        this.ledger
          .getPlan(transaction.installment.plan_id)
          .subscribe((plan) => this.plan.set(plan));
      } else {
        this.transaction.set(transaction);
      }
    });
  }
}
