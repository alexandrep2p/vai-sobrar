import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { TuiButton, TuiDataList, TuiDropdown, TuiInput } from '@taiga-ui/core';
import { TuiChevron, TuiInputMonth, TuiSelect } from '@taiga-ui/kit';
import type { CreditCard, InvoiceSummary } from '../../core/api/models';
import { Clock } from '../../core/clock';
import { CatalogService } from '../../core/data/catalog.service';
import { LedgerService } from '../../core/data/ledger.service';
import { addMonths, formatDate, formatMonth } from '../../shared/format/dates';
import { formatCents } from '../../shared/format/money';
import { ISO_DATE_INPUTS } from '../../shared/forms/iso-dates';
import {
  invoiceStatusLabel,
  NO_ENTRIES_CYCLE_LABEL,
  OVERDUE_INVOICE_LABEL,
  PROJECTED_ITEM_LABEL,
} from '../../shared/labels/labels';
import { AppDialog } from '../../shared/ui/dialog';
import { LoadState, type LoadStatus } from '../../shared/ui/load-state';
import { InvoiceDetailDialog } from './invoice-detail-dialog';

/** Faturas por cartão, num período de meses (12 meses a partir do mês atual). */
const MONTHS_BEFORE = 0;
const MONTHS_AFTER = 11;

@Component({
  selector: 'app-invoices-page',
  imports: [
    FormsModule,
    LoadState,
    RouterLink,
    TuiButton,
    TuiInput,
    TuiDataList,
    TuiDropdown,
    TuiChevron,
    TuiSelect,
    TuiInputMonth,
  ],
  templateUrl: './invoices.page.html',
  providers: [ISO_DATE_INPUTS],
  styles: `
    .filters {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
      margin-bottom: 1rem;
    }
    .filters tui-textfield {
      flex: 1 1 12rem;
    }
  `,
})
export class InvoicesPage implements OnInit {
  private readonly catalog = inject(CatalogService);
  private readonly ledger = inject(LedgerService);
  private readonly dialog = inject(AppDialog);
  private readonly clock = inject(Clock);
  private readonly route = inject(ActivatedRoute);

  protected readonly status = signal<LoadStatus>('loading');
  protected readonly cards = signal<CreditCard[]>([]);
  protected readonly cardId = signal<string | null>(null);
  protected readonly from = signal(addMonths(this.clock.currentMonth(), -MONTHS_BEFORE));
  protected readonly to = signal(addMonths(this.clock.currentMonth(), MONTHS_AFTER));
  protected readonly invoices = signal<InvoiceSummary[]>([]);
  protected readonly card = computed(
    () => this.cards().find((c) => c.id === this.cardId()) ?? null,
  );

  protected readonly money = formatCents;
  protected readonly date = formatDate;
  protected readonly month = formatMonth;
  protected readonly statusLabel = invoiceStatusLabel;
  protected readonly overdueLabel = OVERDUE_INVOICE_LABEL;
  protected readonly projectedLabel = PROJECTED_ITEM_LABEL;
  protected readonly emptyCycleLabel = NO_ENTRIES_CYCLE_LABEL;

  protected cardLabel(card: CreditCard): string {
    return card.active ? card.name : `${card.name} (inativo)`;
  }

  /** Texto do select de cartão (o valor é o id). */
  protected readonly cardName = (id: string | null): string => {
    const card = this.cards().find((c) => c.id === id);
    return card ? this.cardLabel(card) : '';
  };

  ngOnInit(): void {
    this.loadCards();
  }

  protected loadCards(): void {
    this.status.set('loading');
    this.catalog.creditCards().subscribe({
      next: (cards) => {
        this.cards.set(cards);
        const wanted = this.route.snapshot.queryParamMap.get('cartao');
        const initial =
          cards.find((c) => c.id === wanted) ?? cards.find((c) => c.active) ?? cards[0];
        this.cardId.set(initial?.id ?? null);
        if (initial) this.loadInvoices();
        else this.status.set('ready');
      },
      error: () => this.status.set('error'),
    });
  }

  protected loadInvoices(): void {
    const id = this.cardId();
    if (!id) return;
    this.status.set('loading');
    this.ledger.invoices(id, this.from(), this.to()).subscribe({
      next: (invoices) => {
        this.invoices.set(invoices);
        this.status.set('ready');
      },
      error: () => this.status.set('error'),
    });
  }

  protected selectCard(id: string): void {
    this.cardId.set(id);
    this.loadInvoices();
  }

  protected setRange(from: string, to: string): void {
    const valid = /^\d{4}-\d{2}$/;
    if (!valid.test(from) || !valid.test(to) || from > to) return;
    this.from.set(from);
    this.to.set(to);
    this.loadInvoices();
  }

  protected open(invoice: InvoiceSummary): void {
    const card = this.card();
    if (!card || (!invoice.id && invoice.projected_total === 0)) return;
    this.dialog
      .open(InvoiceDetailDialog, { invoiceId: invoice.id, month: invoice.reference_month, card })
      .subscribe((changed) => changed && this.loadInvoices());
  }
}
