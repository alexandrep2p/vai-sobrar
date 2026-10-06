import { NgTemplateOutlet } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { MatButton, MatIconButton } from '@angular/material/button';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIcon } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatSelectModule } from '@angular/material/select';
import { Observable } from 'rxjs';
import type { MonthlyStatement, Ref, RefundSituation, StatementItem } from '../../core/api/models';
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
import { AppDialog } from '../../shared/ui/dialog';
import { LoadState, type LoadStatus } from '../../shared/ui/load-state';
import { PayDialog, type PayDialogResult } from '../../shared/ui/pay-dialog';
import { CloseMonthDialog } from './close-month-dialog';
import { itemActions, refundTargetKey, type ItemActions } from './item-actions';
import { PurchaseDetailDialog } from './purchase-detail-dialog';
import { RefundDialog } from './refund-dialog';
import { TransactionEditDialog } from './transaction-edit-dialog';
import { TransactionFormDialog } from './transaction-form-dialog';

/** Itens de um cartão no mês, exibidos em um painel (PD-39). */
interface CardGroup {
  card: Ref;
  items: StatementItem[];
  /** Soma dos valores com sinal dos itens exibidos. */
  total: number;
}

const byName = (a: Ref, b: Ref): number => a.name.localeCompare(b.name, 'pt-BR');

function uniqueRefs(refs: Ref[]): Ref[] {
  return [...new Map(refs.map((r) => [r.id, r])).values()].sort(byName);
}

@Component({
  selector: 'app-home-page',
  imports: [
    NgTemplateOutlet,
    MatButton,
    MatIconButton,
    MatIcon,
    MatMenuModule,
    MatExpansionModule,
    MatFormFieldModule,
    MatSelectModule,
    LoadState,
  ],
  templateUrl: './home.page.html',
  styleUrl: './home.page.css',
})
export class HomePage implements OnInit {
  private readonly ledger = inject(LedgerService);
  private readonly dialog = inject(AppDialog);
  private readonly clock = inject(Clock);

  protected readonly month = signal(this.clock.currentMonth());
  protected readonly status = signal<LoadStatus>('loading');
  protected readonly statement = signal<MonthlyStatement | null>(null);
  protected readonly refundStates = signal<Record<string, RefundSituation>>({});

  // --- filtros (PD-39): múltipla escolha; "ou" dentro de cada filtro, "e" entre eles ---
  protected readonly categoryFilter = signal<string[]>([]);
  protected readonly methodFilter = signal<string[]>([]);

  protected readonly categoryOptions = computed(() =>
    uniqueRefs((this.statement()?.items ?? []).map((i) => i.category)),
  );
  protected readonly methodOptions = computed(() =>
    uniqueRefs((this.statement()?.items ?? []).map((i) => i.payment_method)),
  );
  protected readonly filtersActive = computed(
    () => this.categoryFilter().length > 0 || this.methodFilter().length > 0,
  );
  protected readonly filteredItems = computed(() => {
    const categories = this.categoryFilter();
    const methods = this.methodFilter();
    return (this.statement()?.items ?? []).filter(
      (i) =>
        (categories.length === 0 || categories.includes(i.category.id)) &&
        (methods.length === 0 || methods.includes(i.payment_method.id)),
    );
  });
  protected readonly filteredSummary = computed(() => ({
    count: this.filteredItems().length,
    total: this.filteredItems().reduce((sum, i) => sum + i.signed_amount, 0),
  }));

  /** Itens de cartão agrupados por cartão (ordem de primeira aparição no extrato). */
  protected readonly cardGroups = computed<CardGroup[]>(() => {
    const groups = new Map<string, CardGroup>();
    for (const item of this.filteredItems()) {
      if (!item.credit_card) continue;
      const group = groups.get(item.credit_card.id) ?? {
        card: item.credit_card,
        items: [],
        total: 0,
      };
      group.items.push(item);
      group.total += item.signed_amount;
      groups.set(item.credit_card.id, group);
    }
    return [...groups.values()];
  });
  protected readonly otherItems = computed(() =>
    this.filteredItems().filter((i) => i.credit_card === null),
  );

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
        this.pruneFilters(statement);
        this.status.set('ready');
        this.loadRefundStates(statement.items);
      },
      error: () => this.status.set('error'),
    });
  }

  protected clearFilters(): void {
    this.categoryFilter.set([]);
    this.methodFilter.set([]);
  }

  /** Descarta seleções que não existem mais no mês carregado (evita filtro "fantasma"). */
  private pruneFilters(statement: MonthlyStatement): void {
    const categories = new Set(statement.items.map((i) => i.category.id));
    const methods = new Set(statement.items.map((i) => i.payment_method.id));
    this.categoryFilter.update((ids) => ids.filter((id) => categories.has(id)));
    this.methodFilter.update((ids) => ids.filter((id) => methods.has(id)));
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
    this.afterSaved(this.dialog.open(TransactionFormDialog));
  }

  protected closeMonth(): void {
    this.afterSaved(this.dialog.open(CloseMonthDialog, this.month()));
  }

  protected edit(item: StatementItem): void {
    this.afterSaved(this.dialog.open(TransactionEditDialog, item));
  }

  protected pay(item: StatementItem): void {
    const data = { title: 'Pagar lançamento', confirmLabel: 'Pagar', message: item.description };
    this.dialog.open<PayDialogResult>(PayDialog, data).subscribe((result) => {
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
    this.afterSaved(this.dialog.open(RefundDialog, data));
  }

  protected openPurchase(item: StatementItem): void {
    const data = item.installment
      ? { planId: item.installment.installment_plan_id }
      : { transactionId: item.refund?.original_transaction_id };
    this.afterSaved(this.dialog.open(PurchaseDetailDialog, data));
  }

  // --- internos ---

  private confirm(data: ConfirmData, run: () => Observable<unknown>): void {
    this.dialog
      .open(ConfirmDialog, data)
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
