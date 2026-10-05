import { Component, inject } from '@angular/core';
import { MatButton } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialog, MatDialogModule } from '@angular/material/dialog';
import { map, Observable } from 'rxjs';
import { dialogConfig } from './dialog';

export interface SummaryRow {
  label: string;
  value: string;
}

export interface SummaryData {
  title: string;
  rows: SummaryRow[];
  confirmLabel: string;
}

/** Resumo dos dados antes de gravar (PD-37): "Voltar" retorna ao formulário, "Confirmar" grava. */
@Component({
  selector: 'app-summary-dialog',
  imports: [MatDialogModule, MatButton],
  template: `
    <h2 mat-dialog-title>{{ data.title }}</h2>
    <mat-dialog-content>
      <dl class="summary-list" data-testid="summary">
        @for (row of data.rows; track row.label) {
          <div class="summary-row">
            <dt>{{ row.label }}</dt>
            <dd>{{ row.value }}</dd>
          </div>
        }
      </dl>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button [mat-dialog-close]="false" data-testid="summary-back">Voltar</button>
      <button mat-flat-button [mat-dialog-close]="true" data-testid="summary-confirm">
        {{ data.confirmLabel }}
      </button>
    </mat-dialog-actions>
  `,
  styles: `
    .summary-list {
      margin: 0;
    }
    .summary-row {
      display: flex;
      justify-content: space-between;
      gap: 1rem;
      padding: 0.35rem 0;
      border-bottom: 1px solid var(--mat-sys-outline-variant, #ddd);
    }
    dt {
      color: var(--mat-sys-on-surface-variant, #666);
    }
    dd {
      margin: 0;
      font-weight: 500;
      text-align: right;
      overflow-wrap: anywhere;
    }
  `,
})
export class SummaryDialog {
  protected readonly data = inject<SummaryData>(MAT_DIALOG_DATA);
}

/** Abre o resumo e emite `true` somente se o usuário confirmar. */
export function confirmSummary(dialog: MatDialog, data: SummaryData): Observable<boolean> {
  return dialog
    .open(SummaryDialog, dialogConfig(data))
    .afterClosed()
    .pipe(map((result) => result === true));
}
