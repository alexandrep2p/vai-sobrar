import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { MatButton } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInput } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { ActivatedRoute, RouterLink } from '@angular/router';
import type { CreditCard, InvoiceSummary } from '../../core/api/models';
import { Clock } from '../../core/clock';
import { CatalogService } from '../../core/data/catalog.service';
import { LedgerService } from '../../core/data/ledger.service';
import { addMonths, formatDate, formatMonth } from '../../shared/format/dates';
import { formatCents } from '../../shared/format/money';
import {
  invoiceStatusLabel,
  NO_ENTRIES_CYCLE_LABEL,
  OVERDUE_INVOICE_LABEL,
} from '../../shared/labels/labels';
import { dialogConfig } from '../../shared/ui/dialog';
import { LoadState, type LoadStatus } from '../../shared/ui/load-state';
import { InvoiceDetailDialog } from './invoice-detail-dialog';

/** Faturas por cartão, num período de meses (12 meses a partir de 3 meses atrás). */
const MONTHS_BEFORE = 3;
const MONTHS_AFTER = 8;

@Component({
  selector: 'app-invoices-page',
  imports: [MatButton, MatFormFieldModule, MatInput, MatSelectModule, LoadState, RouterLink],
  templateUrl: './invoices.page.html',
})
export class InvoicesPage implements OnInit {
  private readonly catalog = inject(CatalogService);
  private readonly ledger = inject(LedgerService);
  private readonly dialog = inject(MatDialog);
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
  protected readonly emptyCycleLabel = NO_ENTRIES_CYCLE_LABEL;

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
    if (!invoice.id || !card) return;
    this.dialog
      .open(InvoiceDetailDialog, dialogConfig({ invoiceId: invoice.id, card }))
      .afterClosed()
      .subscribe((changed) => changed && this.loadInvoices());
  }
}
