import { Component, inject, signal } from '@angular/core';
import { TuiButton } from '@taiga-ui/core';
import { ApiError } from '../../core/api/api-error';
import { LedgerService } from '../../core/data/ledger.service';
import { formatMonthShort } from '../../shared/format/dates';
import { injectDialog } from '../../shared/ui/dialog';

/** Confirmação do fechamento do mês (home.md §7): irreversível; mostra o motivo se rejeitado. */
@Component({
  selector: 'app-close-month-dialog',
  imports: [TuiButton],
  template: `
    <h2 class="dialog-title">Fechar {{ monthLabel }}?</h2>
    <div class="dialog-content">
      <p>
        Ao fechar o mês, todos os lançamentos deste período ficarão imutáveis. O mês não poderá ser
        reaberto.
      </p>
      @if (rejection()) {
        <p class="inline-error" role="alert" data-testid="rejection">{{ rejection() }}</p>
      }
    </div>
    <footer class="dialog-actions">
      <button tuiButton appearance="flat" type="button" (click)="ref.close()">Cancelar</button>
      <button
        tuiButton
        appearance="primary-destructive"
        type="button"
        [disabled]="submitting()"
        (click)="close()"
        data-testid="confirm-close"
      >
        Fechar mês
      </button>
    </footer>
  `,
})
export class CloseMonthDialog {
  protected readonly ref = injectDialog<string, boolean>();
  private readonly month = this.ref.data;
  private readonly ledger = inject(LedgerService);

  protected readonly monthLabel = formatMonthShort(this.month);
  protected readonly submitting = signal(false);
  protected readonly rejection = signal<string | null>(null);

  protected close(): void {
    this.submitting.set(true);
    this.rejection.set(null);
    this.ledger.closeMonth(this.month).subscribe({
      next: () => this.ref.close(true),
      error: (error: unknown) => {
        this.submitting.set(false);
        this.rejection.set(
          error instanceof ApiError ? error.message : 'Não foi possível fechar o mês.',
        );
      },
    });
  }
}
