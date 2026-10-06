import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { MatButton, MatIconButton } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';
import { RouterLink } from '@angular/router';
import type { CreditCard } from '../../core/api/models';
import { CatalogService } from '../../core/data/catalog.service';
import { AppDialog } from '../../shared/ui/dialog';
import { LoadState, type LoadStatus } from '../../shared/ui/load-state';
import { CardDialog } from './card-dialog';

@Component({
  selector: 'app-credit-cards-page',
  imports: [MatButton, MatIconButton, MatIcon, LoadState, RouterLink],
  templateUrl: './credit-cards.page.html',
})
export class CreditCardsPage implements OnInit {
  private readonly catalog = inject(CatalogService);
  private readonly dialog = inject(AppDialog);

  protected readonly status = signal<LoadStatus>('loading');
  protected readonly cards = signal<CreditCard[]>([]);
  protected readonly sections = computed(() => [
    { title: 'Ativos', items: this.cards().filter((c) => c.active) },
    { title: 'Inativos', items: this.cards().filter((c) => !c.active) },
  ]);

  ngOnInit(): void {
    this.load();
  }

  protected load(): void {
    this.status.set('loading');
    this.catalog.creditCards().subscribe({
      next: (cards) => {
        this.cards.set(cards);
        this.status.set('ready');
      },
      error: () => this.status.set('error'),
    });
  }

  protected create(): void {
    this.open(null);
  }

  protected edit(card: CreditCard): void {
    this.open(card);
  }

  protected toggle(card: CreditCard): void {
    this.catalog.setCreditCardActive(card.id, !card.active).subscribe(() => this.load());
  }

  private open(card: CreditCard | null): void {
    this.dialog.open(CardDialog, card).subscribe((saved) => saved && this.load());
  }
}
