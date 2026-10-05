import { Component, inject, OnInit, signal } from '@angular/core';
import { MatButton } from '@angular/material/button';
import {
  MAT_DIALOG_DATA,
  MatDialog,
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';
import type { CreditCard, InvoiceDetail } from '../../core/api/models';
import { CatalogService } from '../../core/data/catalog.service';
import { LedgerService } from '../../core/data/ledger.service';
import { formatDate, formatMonth } from '../../shared/format/dates';
import { formatCents } from '../../shared/format/money';
import {
  invoiceStatusLabel,
  OVERDUE_INVOICE_LABEL,
  PROJECTED_ITEM_LABEL,
  transactionStatusLabel,
} from '../../shared/labels/labels';
import { dialogConfig } from '../../shared/ui/dialog';
import { PayDialog, type PayDialogData, type PayDialogResult } from '../../shared/ui/pay-dialog';

export interface InvoiceDetailData {
  /** `null` para ciclo ainda sem fatura persistida (só com a previsão de recorrências). */
  invoiceId: string | null;
  month: string;
  card: CreditCard;
}

/** Detalhe da fatura (invoices.md §7) e ação "Pagar fatura" (somente fatura fechada). */
@Component({
  selector: 'app-invoice-detail-dialog',
  imports: [MatDialogModule, MatButton],
  template: `
    <h2 mat-dialog-title>
      Fatura {{ data.card.name }}
      @if (invoice(); as i) {
        · {{ month(i.reference_month) }}
      }
    </h2>
    <mat-dialog-content>
      @if (invoice(); as i) {
        <p class="invoice-status">
          <span class="chip" [class.positive]="i.status === 'PAID'" data-testid="status">
            {{ statusLabel(i.status) }}
          </span>
          @if (i.situation === 'OVERDUE') {
            <span class="chip warn" data-testid="overdue">{{ overdueLabel }}</span>
          }
        </p>
        <p class="hint-text">
          Fechamento: {{ date(i.closing_date) }} · Vencimento: {{ date(i.due_date) }}
          @if (i.paid_at) {
            · Paga em {{ date(i.paid_at) }}
          }
        </p>

        <h3 class="group-title">Lançamentos</h3>
        @if (i.transactions.length === 0) {
          <p class="hint-text">Nenhum lançamento.</p>
        } @else {
          <div class="list-card">
            @for (t of i.transactions; track t.id) {
              <div class="list-row" data-testid="invoice-transaction">
                <div class="grow">
                  {{ t.description }}
                  @if (t.installment; as inst) {
                    · {{ inst.number }}/{{ inst.installment_count }}
                  }
                  <div class="sub">
                    {{ date(t.purchase_date ?? t.due_date) }} · {{ t.category.name }}
                  </div>
                </div>
                <span class="expense">{{ money(t.amount) }}</span>
                <span class="chip" [class.positive]="t.status === 'PAID'">{{
                  txStatusLabel(t.status)
                }}</span>
              </div>
            }
          </div>
        }

        @if (i.projected_items.length > 0) {
          <h3 class="group-title">Recorrências previstas</h3>
          <div class="list-card">
            @for (p of i.projected_items; track p.recurrence_id + p.occurrence_month) {
              <div class="list-row" data-testid="projected-item">
                <div class="grow">
                  {{ p.description }}
                  <div class="sub">{{ date(p.purchase_date) }} · {{ p.category.name }}</div>
                </div>
                <span class="expense">{{ money(p.amount) }}</span>
                <span class="chip" data-testid="projected-chip">{{ projectedLabel }}</span>
              </div>
            }
          </div>
        }

        @if (i.credits.length > 0) {
          <h3 class="group-title">Créditos de estorno</h3>
          <div class="list-card">
            @for (c of i.credits; track c.allocation_id) {
              <div class="list-row" data-testid="invoice-credit">
                <div class="grow">
                  {{ c.description }}
                  <div class="sub">Estorno em {{ date(c.refund_date) }}</div>
                </div>
                <span class="income">+ {{ money(c.amount) }}</span>
              </div>
            }
          </div>
        }

        @if (i.received_credits.length > 0) {
          <h3 class="group-title">Crédito recebido de faturas anteriores</h3>
          <div class="list-card">
            @for (r of i.received_credits; track r.invoice_id) {
              <div class="list-row" data-testid="received-credit">
                <div class="grow">Fatura de {{ month(r.reference_month) }}</div>
                <span class="income">+ {{ money(r.amount) }}</span>
              </div>
            }
          </div>
        }

        <h3 class="group-title">Totais</h3>
        <dl class="totals">
          <dt>Débitos</dt>
          <dd>{{ money(i.totals.debits) }}</dd>
          @if (i.projected_total > 0) {
            <dt class="sub">Destes, previstos (recorrências)</dt>
            <dd class="sub" data-testid="projected-total">{{ money(i.projected_total) }}</dd>
          }
          <dt>Créditos de estorno</dt>
          <dd>{{ money(i.totals.credits) }}</dd>
          <dt>Crédito recebido</dt>
          <dd>{{ money(i.totals.received_credit) }}</dd>
          <dt><strong>Valor a pagar</strong></dt>
          <dd data-testid="amount-due">
            <strong>{{ money(i.totals.amount_due) }}</strong>
          </dd>
          <dt>Saldo credor</dt>
          <dd data-testid="credit-balance">{{ money(i.totals.credit_balance) }}</dd>
        </dl>
      } @else {
        <p>Carregando…</p>
      }
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>Fechar</button>
      @if (invoice()?.id && invoice()?.status !== 'PAID') {
        <button mat-flat-button (click)="pay()" data-testid="pay-invoice">Pagar fatura</button>
      }
    </mat-dialog-actions>
  `,
  styles: `
    .totals {
      display: grid;
      grid-template-columns: 1fr auto;
      gap: 0.25rem 1rem;
      margin: 0;
    }
    .totals dd {
      margin: 0;
      text-align: right;
    }
  `,
})
export class InvoiceDetailDialog implements OnInit {
  protected readonly data = inject<InvoiceDetailData>(MAT_DIALOG_DATA);
  private readonly ref = inject(MatDialogRef<InvoiceDetailDialog, boolean>);
  private readonly dialog = inject(MatDialog);
  private readonly ledger = inject(LedgerService);
  private readonly catalog = inject(CatalogService);

  protected readonly invoice = signal<InvoiceDetail | null>(null);
  protected readonly money = formatCents;
  protected readonly date = formatDate;
  protected readonly month = formatMonth;
  protected readonly statusLabel = invoiceStatusLabel;
  protected readonly txStatusLabel = transactionStatusLabel;
  protected readonly overdueLabel = OVERDUE_INVOICE_LABEL;
  protected readonly projectedLabel = PROJECTED_ITEM_LABEL;

  ngOnInit(): void {
    const request = this.data.invoiceId
      ? this.ledger.invoice(this.data.invoiceId)
      : this.ledger.invoiceCycle(this.data.card.id, this.data.month);
    request.subscribe((invoice) => this.invoice.set(invoice));
  }

  /** Método de pagamento: qualquer ativo, exceto o próprio cartão da fatura (invoices.md §9.1). */
  protected pay(): void {
    this.catalog.paymentMethods().subscribe((methods) => {
      const options = methods
        .filter((m) => m.active && m.id !== this.data.card.payment_method_id)
        .map((m) => ({ id: m.id, name: m.name }));
      const current = this.invoice();
      const projected = current?.projected_total ?? 0;
      const payData: PayDialogData = {
        title: 'Pagar fatura',
        confirmLabel: 'Pagar',
        message:
          `Valor a pagar: ${formatCents(current?.totals.amount_due ?? 0)}` +
          (projected > 0
            ? ` (inclui ${formatCents(projected)} de recorrências previstas, que serão geradas e pagas agora)`
            : ''),
        methods: options,
      };
      this.dialog
        .open<PayDialog, PayDialogData, PayDialogResult>(PayDialog, dialogConfig(payData))
        .afterClosed()
        .subscribe((result) => {
          if (!result) return;
          this.ledger
            .payInvoice(this.data.invoiceId as string, {
              paid_at: result.paid_at,
              payment_method_id: result.payment_method_id as string,
            })
            .subscribe((paid) => {
              this.invoice.set(paid);
              this.ref.close(true);
            });
        });
    });
  }
}
