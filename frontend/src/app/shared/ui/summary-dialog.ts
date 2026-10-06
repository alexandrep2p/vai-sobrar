import { Component } from '@angular/core';
import { TuiButton } from '@taiga-ui/core';
import { map, Observable } from 'rxjs';
import { AppDialog, injectDialog } from './dialog';

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
  imports: [TuiButton],
  template: `
    <h2 class="dialog-title">{{ data.title }}</h2>
    <div class="dialog-content">
      <dl class="summary-list" data-testid="summary">
        @for (row of data.rows; track row.label) {
          <div class="summary-row">
            <dt>{{ row.label }}</dt>
            <dd>{{ row.value }}</dd>
          </div>
        }
      </dl>
    </div>
    <footer class="dialog-actions">
      <button tuiButton appearance="flat" (click)="ref.close(false)" data-testid="summary-back">
        Voltar
      </button>
      <button tuiButton (click)="ref.close(true)" data-testid="summary-confirm">
        {{ data.confirmLabel }}
      </button>
    </footer>
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
      border-bottom: 1px solid var(--tui-border-normal);
    }
    dt {
      color: var(--tui-text-secondary);
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
  protected readonly ref = injectDialog<SummaryData, boolean>();
  protected readonly data = this.ref.data;
}

/** Abre o resumo e emite `true` somente se o usuário confirmar. */
export function confirmSummary(dialog: AppDialog, data: SummaryData): Observable<boolean> {
  return dialog.open(SummaryDialog, data).pipe(map((result) => result === true));
}
