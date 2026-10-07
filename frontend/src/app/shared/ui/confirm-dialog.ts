import { Component } from '@angular/core';
import { TuiButton } from '@taiga-ui/core';
import { injectDialog } from './dialog';

export interface ConfirmData {
  title: string;
  message: string;
  confirmLabel: string;
  /** Ação destrutiva/irreversível: destaca o botão de confirmação. */
  destructive?: boolean;
}

@Component({
  selector: 'app-confirm-dialog',
  imports: [TuiButton],
  template: `
    <h2 class="dialog-title">{{ data.title }}</h2>
    <div class="dialog-content">
      <p class="confirm-message">{{ data.message }}</p>
    </div>
    <footer class="dialog-actions">
      <button tuiButton appearance="flat" (click)="ref.close(false)">Cancelar</button>
      <button
        tuiButton
        [appearance]="data.destructive ? 'primary-destructive' : 'primary'"
        (click)="ref.close(true)"
        data-testid="confirm"
      >
        {{ data.confirmLabel }}
      </button>
    </footer>
  `,
})
export class ConfirmDialog {
  protected readonly ref = injectDialog<ConfirmData, boolean>();
  protected readonly data = this.ref.data;
}
