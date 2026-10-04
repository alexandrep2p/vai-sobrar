import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { MatButton, MatIconButton } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIcon } from '@angular/material/icon';
import { RouterLink } from '@angular/router';
import type { PaymentMethod } from '../../core/api/models';
import { CatalogService } from '../../core/data/catalog.service';
import { paymentMethodKindLabel, paymentMethodSourceLabel } from '../../shared/labels/labels';
import { dialogConfig } from '../../shared/ui/dialog';
import { LoadState, type LoadStatus } from '../../shared/ui/load-state';
import { MethodDialog } from './method-dialog';

@Component({
  selector: 'app-payment-methods-page',
  imports: [MatButton, MatIconButton, MatIcon, LoadState, RouterLink],
  templateUrl: './payment-methods.page.html',
})
export class PaymentMethodsPage implements OnInit {
  private readonly catalog = inject(CatalogService);
  private readonly dialog = inject(MatDialog);

  protected readonly status = signal<LoadStatus>('loading');
  protected readonly methods = signal<PaymentMethod[]>([]);
  protected readonly sections = computed(() => [
    { title: 'Ativos', items: this.methods().filter((m) => m.active) },
    { title: 'Inativos', items: this.methods().filter((m) => !m.active) },
  ]);
  protected readonly sourceLabel = paymentMethodSourceLabel;
  protected readonly kindLabel = paymentMethodKindLabel;

  ngOnInit(): void {
    this.load();
  }

  protected load(): void {
    this.status.set('loading');
    this.catalog.paymentMethods().subscribe({
      next: (methods) => {
        this.methods.set(methods);
        this.status.set('ready');
      },
      error: () => this.status.set('error'),
    });
  }

  /** Só métodos personalizados comuns são editáveis aqui; cartões usam o fluxo de cartão. */
  protected isEditable(method: PaymentMethod): boolean {
    return method.source === 'USER' && method.kind === 'STANDARD';
  }

  protected create(): void {
    this.open(null);
  }

  protected edit(method: PaymentMethod): void {
    this.open(method);
  }

  protected toggle(method: PaymentMethod): void {
    this.catalog.setPaymentMethodActive(method.id, !method.active).subscribe(() => this.load());
  }

  private open(method: PaymentMethod | null): void {
    this.dialog
      .open(MethodDialog, dialogConfig(method))
      .afterClosed()
      .subscribe((saved) => saved && this.load());
  }
}
