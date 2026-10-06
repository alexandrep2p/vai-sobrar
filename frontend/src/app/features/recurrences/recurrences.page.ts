import { Component, inject, OnInit, signal, Type } from '@angular/core';
import { TuiButton, TuiDataList, TuiDropdown } from '@taiga-ui/core';
import type { Recurrence } from '../../core/api/models';
import { LedgerService } from '../../core/data/ledger.service';
import { formatDate } from '../../shared/format/dates';
import { formatCents } from '../../shared/format/money';
import { recurrenceStatusLabel } from '../../shared/labels/labels';
import { ConfirmDialog } from '../../shared/ui/confirm-dialog';
import { AppDialog } from '../../shared/ui/dialog';
import { LoadState, type LoadStatus } from '../../shared/ui/load-state';
import { PauseDialog } from './pause-dialog';
import { RecurrenceDialog } from './recurrence-dialog';

@Component({
  selector: 'app-recurrences-page',
  imports: [LoadState, TuiButton, TuiDataList, TuiDropdown],
  templateUrl: './recurrences.page.html',
})
export class RecurrencesPage implements OnInit {
  private readonly ledger = inject(LedgerService);
  private readonly dialog = inject(AppDialog);

  protected readonly status = signal<LoadStatus>('loading');
  protected readonly recurrences = signal<Recurrence[]>([]);
  protected readonly money = formatCents;
  protected readonly date = formatDate;
  protected readonly statusLabel = recurrenceStatusLabel;
  /** Menu de ações aberto (id da recorrência): um por vez. */
  protected readonly openMenu = signal<string | null>(null);

  ngOnInit(): void {
    this.load();
  }

  protected closeMenu(): void {
    this.openMenu.set(null);
  }

  protected load(): void {
    this.status.set('loading');
    this.ledger.recurrences().subscribe({
      next: (recurrences) => {
        this.recurrences.set(recurrences);
        this.status.set('ready');
      },
      error: () => this.status.set('error'),
    });
  }

  protected canEdit = (r: Recurrence): boolean => r.status !== 'CANCELLED';
  protected canPause = (r: Recurrence): boolean => r.status === 'ACTIVE';
  protected canResume = (r: Recurrence): boolean => r.status === 'PAUSED';
  protected canCancel = (r: Recurrence): boolean => r.status !== 'CANCELLED';

  protected create(): void {
    this.open(RecurrenceDialog, null);
  }

  protected edit(recurrence: Recurrence): void {
    this.open(RecurrenceDialog, recurrence);
  }

  protected pause(recurrence: Recurrence): void {
    this.open(PauseDialog, recurrence);
  }

  protected resume(recurrence: Recurrence): void {
    this.ledger.resumeRecurrence(recurrence.id).subscribe(() => this.load());
  }

  protected cancel(recurrence: Recurrence): void {
    this.dialog
      .open(ConfirmDialog, {
        title: 'Cancelar recorrência?',
        message: `"${recurrence.description}" será encerrada definitivamente e deixará de gerar ocorrências. Para retomar, será preciso criar uma nova recorrência. As ocorrências já geradas permanecem.`,
        confirmLabel: 'Cancelar recorrência',
        destructive: true,
      })
      .subscribe(
        (confirmed) =>
          confirmed && this.ledger.cancelRecurrence(recurrence.id).subscribe(() => this.load()),
      );
  }

  private open<C>(component: Type<C>, data: Recurrence | null): void {
    this.dialog.open(component, data).subscribe((saved) => saved && this.load());
  }
}
