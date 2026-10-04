import { MatDialogConfig } from '@angular/material/dialog';

/** Config padrão dos diálogos: largura total no mobile (mobile first) e limitada no desktop. */
export function dialogConfig<D = undefined>(data?: D): MatDialogConfig<D> {
  return {
    data,
    width: 'min(36rem, 100vw)',
    maxWidth: '100vw',
    maxHeight: '100dvh',
    autoFocus: 'first-tabbable',
  };
}
