import { BreakpointObserver } from '@angular/cdk/layout';
import { Component, inject, linkedSignal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatDivider } from '@angular/material/divider';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatIconButton } from '@angular/material/button';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { map } from 'rxjs';
import { AuthService } from '../auth/auth.service';
import { NAV_ITEMS } from './nav-items';

/** A partir deste ponto o menu lateral fica fixo; abaixo dele vira uma gaveta (mobile first). */
const DESKTOP_QUERY = '(min-width: 768px)';

@Component({
  selector: 'app-shell',
  imports: [
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    MatSidenavModule,
    MatToolbarModule,
    MatListModule,
    MatIconModule,
    MatIconButton,
    MatDivider,
  ],
  templateUrl: './shell.html',
  styleUrl: './shell.css',
})
export class ShellComponent {
  private readonly auth = inject(AuthService);
  protected readonly items = NAV_ITEMS;
  protected readonly user = this.auth.user;
  protected readonly isDesktop = toSignal(
    inject(BreakpointObserver)
      .observe(DESKTOP_QUERY)
      .pipe(map((state) => state.matches)),
    { initialValue: false },
  );
  /** Aberto por padrão só no desktop; no mobile o usuário abre e fecha. */
  protected readonly navOpen = linkedSignal(() => this.isDesktop());

  protected onNavigate(): void {
    if (!this.isDesktop()) this.navOpen.set(false);
  }

  protected logout(): void {
    this.onNavigate();
    this.auth.logout();
  }
}
