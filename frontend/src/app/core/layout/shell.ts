import { DOCUMENT } from '@angular/common';
import { Component, computed, DestroyRef, inject, linkedSignal, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { TUI_DARK_MODE, TuiButton, TuiIcon } from '@taiga-ui/core';
import { AuthService } from '../auth/auth.service';
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
  private readonly auth = inject(AuthService);
  protected readonly items = NAV_ITEMS;
  protected readonly user = this.auth.user;
  protected readonly isDesktop = desktopSignal();
  /** Aberto por padrão só no desktop; no mobile o usuário abre e fecha. */
  protected readonly navOpen = linkedSignal(() => this.isDesktop());

  /** Tema escuro (PD-40): segue o sistema até a escolha no botão, que fica salva no navegador. */
  protected readonly dark = inject(TUI_DARK_MODE);
  protected readonly themeLabel = computed(() =>
    this.dark() ? 'Ativar modo claro' : 'Ativar modo escuro',
  );

  protected toggleTheme(): void {
    this.dark.set(!this.dark());
  }

  protected onNavigate(): void {
    if (!this.isDesktop()) this.navOpen.set(false);
  }

  protected logout(): void {
    this.onNavigate();
    this.auth.logout();
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
