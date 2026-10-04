import { Component, inject, signal } from '@angular/core';
import { MatButton } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { ApiError } from '../../core/api/api-error';
import { LedgerService } from '../../core/data/ledger.service';
import { formatMonthShort } from '../../shared/format/dates';

/** Confirmação do fechamento do mês (home.md §7): irreversível; mostra o motivo se rejeitado. */
@Component({
  selector: 'app-close-month-dialog',
  imports: [MatDialogModule, MatButton],
  template: `
    <h2 mat-dialog-title>Fechar {{ monthLabel }}?</h2>
    <mat-dialog-content>
      <p>
        Ao fechar o mês, todos os lançamentos deste período ficarão imutáveis. O mês não poderá ser
        reaberto.
      </p>
      @if (rejection()) {
        <p class="inline-error" role="alert" data-testid="rejection">{{ rejection() }}</p>
      }
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button type="button" mat-dialog-close>Cancelar</button>
      <button
        mat-flat-button
        class="destructive"
        type="button"
        [disabled]="submitting()"
        (click)="close()"
        data-testid="confirm-close"
      >
        Fechar mês
      </button>
    </mat-dialog-actions>
  `,
})
export class CloseMonthDialog {
  private readonly month = inject<string>(MAT_DIALOG_DATA);
  private readonly ref = inject(MatDialogRef<CloseMonthDialog, boolean>);
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
