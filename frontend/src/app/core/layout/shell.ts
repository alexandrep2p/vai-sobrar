import { DOCUMENT } from '@angular/common';
import { Component, DestroyRef, inject, linkedSignal, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { TuiButton, TuiIcon } from '@taiga-ui/core';
import { NAV_ITEMS } from './nav-items';

/** A partir deste ponto o menu lateral fica fixo; abaixo dele vira uma gaveta (mobile first). */
const DESKTOP_QUERY = '(min-width: 768px)';

@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, TuiButton, TuiIcon],
  templateUrl: './shell.html',
  styleUrl: './shell.css',
  host: { '(document:keydown.escape)': 'onNavigate()' },
})
export class ShellComponent {
  protected readonly items = NAV_ITEMS;
  protected readonly isDesktop = desktopSignal();
  /** Aberto por padrão só no desktop; no mobile o usuário abre e fecha. */
  protected readonly navOpen = linkedSignal(() => this.isDesktop());

  protected onNavigate(): void {
    if (!this.isDesktop()) this.navOpen.set(false);
  }
}

/** `true` enquanto a tela atende a `DESKTOP_QUERY`; sem `matchMedia` (testes), vale mobile. */
function desktopSignal() {
  const media = inject(DOCUMENT).defaultView?.matchMedia?.(DESKTOP_QUERY);
  const matches = signal(media?.matches ?? false);
  if (media) {
    const listener = (event: MediaQueryListEvent) => matches.set(event.matches);
    media.addEventListener('change', listener);
    inject(DestroyRef).onDestroy(() => media.removeEventListener('change', listener));
  }
  return matches.asReadonly();
}
