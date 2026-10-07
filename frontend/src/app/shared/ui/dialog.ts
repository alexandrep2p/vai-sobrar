import { inject, Injectable, type Type } from '@angular/core';
import { type TuiDialogContext, TuiDialogService } from '@taiga-ui/core';
import { injectContext, PolymorpheusComponent } from '@taiga-ui/polymorpheus';
import { defaultIfEmpty, type Observable } from 'rxjs';

/**
 * Abre diálogos do app (Taiga UI). Largura total no mobile (mobile first) e limitada no desktop,
 * via `styles.css`. Emite o valor de `close(valor)` ou `undefined` se o diálogo for dispensado
 * (Cancelar, X, Esc ou clique fora) e então completa.
 */
@Injectable({ providedIn: 'root' })
export class AppDialog {
  private readonly dialogs = inject(TuiDialogService);

  open<R = unknown, D = unknown>(component: Type<unknown>, data?: D): Observable<R | undefined> {
    return this.dialogs
      .open<R>(new PolymorpheusComponent(component), { data, size: 'm' })
      .pipe(defaultIfEmpty(undefined));
  }
}

/** Acesso, dentro do componente aberto por `AppDialog`, aos dados recebidos e ao fechamento. */
export interface DialogRef<D, R> {
  readonly data: D;
  /** Fecha devolvendo `result`; sem argumento, apenas dispensa o diálogo. */
  close(result?: R): void;
}

export function injectDialog<D = undefined, R = boolean>(): DialogRef<D, R> {
  const context = injectContext<TuiDialogContext<R, D>>();
  return {
    data: context.data as D,
    close: (result?: R) =>
      result === undefined ? context.$implicit.complete() : context.completeWith(result),
  };
}
