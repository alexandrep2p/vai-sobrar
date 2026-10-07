import { Component, input, output } from '@angular/core';
import { TuiButton, TuiLoader } from '@taiga-ui/core';

export type LoadStatus = 'loading' | 'ready' | 'error';

/** Estados de uma carga: carregando, erro com nova tentativa, vazio e conteúdo (projetado). */
@Component({
  selector: 'app-load-state',
  imports: [TuiButton, TuiLoader],
  template: `
    @switch (status()) {
      @case ('loading') {
        <div class="state-box" role="status">
          <tui-loader size="l" />
          <span>Carregando…</span>
        </div>
      }
      @case ('error') {
        <div class="state-box" role="alert">
          <span>Não foi possível carregar os dados.</span>
          <button tuiButton type="button" appearance="outline" (click)="retry.emit()">
            Tentar novamente
          </button>
        </div>
      }
      @default {
        @if (empty()) {
          <div class="state-box" data-testid="empty">{{ emptyMessage() }}</div>
        } @else {
          <ng-content />
        }
      }
    }
  `,
})
export class LoadState {
  readonly status = input.required<LoadStatus>();
  readonly empty = input(false);
  readonly emptyMessage = input('Nada por aqui ainda.');
  readonly retry = output<void>();
}
