import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { MatButton, MatIconButton } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIcon } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { Observable } from 'rxjs';
import type { MonthlyStatement, RefundSituation, StatementItem } from '../../core/api/models';
import { Clock } from '../../core/clock';
import { LedgerService } from '../../core/data/ledger.service';
import { addMonths, formatMonth, formatShortDate } from '../../shared/format/dates';
import { formatCents, formatSignedCents } from '../../shared/format/money';
import {
  financialPeriodStatusLabel,
  invoiceStatusLabel,
  PARTIALLY_REFUNDED_LABEL,
  REFUNDED_LABEL,
  SKIPPED_OCCURRENCE_LABEL,
  transactionStatusLabel,
} from '../../shared/labels/labels';
import { ConfirmDialog, type ConfirmData } from '../../shared/ui/confirm-dialog';
import { dialogConfig } from '../../shared/ui/dialog';
import { LoadState, type LoadStatus } from '../../shared/ui/load-state';
import { PayDialog, type PayDialogResult } from '../../shared/ui/pay-dialog';
import { CloseMonthDialog } from './close-month-dialog';
import { itemActions, refundTargetKey, type ItemActions } from './item-actions';
import { PurchaseDetailDialog } from './purchase-detail-dialog';
import { RefundDialog } from './refund-dialog';
import { TransactionEditDialog } from './transaction-edit-dialog';
import { TransactionFormDialog } from './transaction-form-dialog';

@Component({
  selector: 'app-home-page',
  imports: [MatButton, MatIconButton, MatIcon, MatMenuModule, LoadState],
  templateUrl: './home.page.html',
  styleUrl: './home.page.css',
})
export class HomePage implements OnInit {
  private readonly ledger = inject(LedgerService);
  private readonly dialog = inject(MatDialog);
  private readonly clock = inject(Clock);

  protected readonly month = signal(this.clock.currentMonth());
  protected readonly status = signal<LoadStatus>('loading');
  protected readonly statement = signal<MonthlyStatement | null>(null);
  protected readonly refundStates = signal<Record<string, RefundSituation>>({});

  protected readonly monthLabel = computed(() => formatMonth(this.month()));
  protected readonly isCurrentMonth = computed(() => this.month() === this.clock.currentMonth());
  protected readonly monthOpen = computed(() => this.statement()?.month.status === 'OPEN');
  protected readonly periodLabel = computed(() => {
    const period = this.statement()?.month;
    return period ? financialPeriodStatusLabel(period.status) : '';
  });

  protected readonly money = formatCents;
  protected readonly signed = formatSignedCents;
  protected readonly shortDate = formatShortDate;
  protected readonly statusLabel = transactionStatusLabel;
  protected readonly invoiceLabel = invoiceStatusLabel;
  protected readonly skippedLabel = SKIPPED_OCCURRENCE_LABEL;

  ngOnInit(): void {
    this.load();
  }

  protected load(): void {
    this.status.set('loading');
    this.ledger.statement(this.month()).subscribe({
      next: (statement) => {
        this.statement.set(statement);
        this.status.set('ready');
        this.loadRefundStates(statement.items);
      },
      error: () => this.status.set('error'),
    });
  }

  // --- navegação entre meses ---

  protected go(delta: number): void {
    this.setMonth(addMonths(this.month(), delta));
  }

  protected goToday(): void {
    this.setMonth(this.clock.currentMonth());
  }

  protected onMonthPicked(value: string): void {
    if (/^\d{4}-\d{2}$/.test(value)) this.setMonth(value);
  }

  private setMonth(month: string): void {
    this.month.set(month);
    this.load();
  }

  // --- apresentação do item ---

  protected actions(item: StatementItem): ItemActions {
    return itemActions(item, this.monthOpen());
  }

  protected hasActions(a: ItemActions): boolean {
    return a.edit || a.pay || a.unpay || a.delete || a.skip || a.refund;
  }

  protected isProjected(item: StatementItem): boolean {
    return item.item_type === 'PROJECTED_OCCURRENCE';
  }

  protected isRefundCredit(item: StatementItem): boolean {
    return item.item_type === 'REFUND_CREDIT';
  }

  protected refundLabel(item: StatementItem): string | null {
    const key = refundTargetKey(item);
    const state = key ? this.refundStates()[key] : null;
    if (state === 'FULLY_REFUNDED') return REFUNDED_LABEL;
    if (state === 'PARTIALLY_REFUNDED') return PARTIALLY_REFUNDED_LABEL;
    return null;
  }

  protected trackKey(item: StatementItem, index: number): string {
    return `${item.item_type}:${item.transaction_id ?? item.recurrence_id ?? item.refund?.refund_id}:${item.occurrence_month ?? ''}:${index}`;
  }

  // --- ações do extrato ---

  protected newTransaction(): void {
    this.afterSaved(this.dialog.open(TransactionFormDialog, dialogConfig()).afterClosed());
  }

  protected closeMonth(): void {
    this.afterSaved(this.dialog.open(CloseMonthDialog, dialogConfig(this.month())).afterClosed());
  }

  protected edit(item: StatementItem): void {
    this.afterSaved(this.dialog.open(TransactionEditDialog, dialogConfig(item)).afterClosed());
  }

  protected pay(item: StatementItem): void {
    const data = { title: 'Pagar lançamento', confirmLabel: 'Pagar', message: item.description };
    this.dialog
      .open<PayDialog, typeof data, PayDialogResult>(PayDialog, dialogConfig(data))
      .afterClosed()
      .subscribe((result) => {
        if (!result) return;
        const request: Observable<unknown> =
          item.recurrence_id && item.occurrence_month
            ? this.ledger.payOccurrence(item.recurrence_id, item.occurrence_month, result.paid_at)
            : this.ledger.payTransaction(item.transaction_id as string, result.paid_at);
        request.subscribe(() => this.load());
      });
  }

  protected unpay(item: StatementItem): void {
    this.ledger.unpayTransaction(item.transaction_id as string).subscribe(() => this.load());
  }

  /** Apagar (PD-38, provisório): exclusão definitiva; parcela apaga a compra parcelada inteira. */
  protected remove(item: StatementItem): void {
    if (item.installment) {
      const plan = item.installment;
      this.confirm(
        {
          title: 'Apagar compra parcelada?',
          message: `"${item.description}" será apagada por inteiro (${plan.installment_count} parcelas), junto com os estornos dela. Não é possível desfazer.`,
          confirmLabel: 'Apagar',
          destructive: true,
        },
        () => this.ledger.deletePlan(plan.installment_plan_id),
      );
      return;
    }
    const withRefunds = item.credit_card !== null ? ', junto com os estornos dele' : '';
    this.confirm(
      {
        title: 'Apagar lançamento?',
        message: `"${item.description}" será apagado definitivamente${withRefunds}. Não é possível desfazer.`,
        confirmLabel: 'Apagar',
        destructive: true,
      },
      () => this.ledger.deleteTransaction(item.transaction_id as string),
    );
  }

  protected skip(item: StatementItem): void {
    this.confirm(
      {
        title: 'Pular ocorrência?',
        message: `A ocorrência de "${item.description}" neste mês não será gerada. A recorrência continua normalmente.`,
        confirmLabel: 'Pular',
      },
      () =>
        this.ledger.skipOccurrence(item.recurrence_id as string, item.occurrence_month as string),
    );
  }

  protected refund(item: StatementItem): void {
    const data = item.installment
      ? { description: item.description, planId: item.installment.installment_plan_id }
      : { description: item.description, transactionId: item.transaction_id as string };
    this.afterSaved(this.dialog.open(RefundDialog, dialogConfig(data)).afterClosed());
  }

  protected openPurchase(item: StatementItem): void {
    const data = item.installment
      ? { planId: item.installment.installment_plan_id }
      : { transactionId: item.refund?.original_transaction_id };
    this.afterSaved(this.dialog.open(PurchaseDetailDialog, dialogConfig(data)).afterClosed());
  }

  // --- internos ---

  private confirm(data: ConfirmData, run: () => Observable<unknown>): void {
    this.dialog
      .open(ConfirmDialog, dialogConfig(data))
      .afterClosed()
      .subscribe((confirmed) => confirmed && run().subscribe(() => this.load()));
  }

  private afterSaved(closed: Observable<unknown>): void {
    closed.subscribe((saved) => saved && this.load());
  }

  /** Situação de estorno (estornada/parcialmente) de cada compra de cartão exibida. */
  private loadRefundStates(items: StatementItem[]): void {
    this.refundStates.set({});
    const seen = new Set<string>();
    for (const item of items) {
      const key = refundTargetKey(item);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      const [kind, id] = key.split(':');
      const request =
        kind === 'plan' ? this.ledger.planRefunds(id) : this.ledger.transactionRefunds(id);
      request.subscribe({
        next: (summary) =>
          this.refundStates.update((states) => ({ ...states, [key]: summary.refund_status })),
        error: () => undefined,
      });
    }
  }
}
