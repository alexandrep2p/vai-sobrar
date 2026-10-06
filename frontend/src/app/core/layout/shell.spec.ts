import { Location } from '@angular/common';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { provideRouter } from '@angular/router';
import { routes } from '../../app.routes';
import { NAV_ITEMS } from './nav-items';

describe('navegação', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideRouter(routes), provideHttpClient(), provideHttpClientTesting()],
    });
  });

  it('redireciona a raiz para a home', async () => {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/');
    expect(TestBed.inject(Location).path()).toBe('/home');
    expect(harness.routeNativeElement?.querySelector('[data-testid="sidenav"]')).not.toBeNull();
  });

  it('abre cada rota do menu', async () => {
    const harness = await RouterTestingHarness.create();
    const router = TestBed.inject(Router);
    for (const item of NAV_ITEMS) {
      await harness.navigateByUrl(item.path);
      expect(router.url).toBe(item.path);
      expect(harness.routeNativeElement?.querySelector('main')).not.toBeNull();
    }
  });

  it('no mobile, abre a gaveta pelo botão e fecha ao navegar', async () => {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/home');
    const root = harness.routeNativeElement as HTMLElement;
    const nav = root.querySelector<HTMLElement>('[data-testid="sidenav"]')!;
    expect(nav.classList).not.toContain('open');

    root.querySelector<HTMLButtonElement>('[data-testid="menu-toggle"]')!.click();
    harness.detectChanges();
    expect(nav.classList).toContain('open');
    expect(root.querySelector('[data-testid="nav-backdrop"]')).not.toBeNull();

    root.querySelectorAll<HTMLElement>('[data-testid="nav-link"]')[1].click();
    await harness.fixture.whenStable();
    harness.detectChanges();
    expect(TestBed.inject(Location).path()).toBe('/faturas');
    expect(nav.classList).not.toContain('open');
  });

  it('lista todos os itens no menu lateral', async () => {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/home');
    const links = harness.routeNativeElement?.querySelectorAll(
      '[data-testid="sidenav"] [data-testid="nav-link"]',
    );
    expect(links?.length).toBe(NAV_ITEMS.length);
  });

  describe('modo escuro (PD-40)', () => {
    async function themeButton() {
      const harness = await RouterTestingHarness.create();
      await harness.navigateByUrl('/home');
      const button = harness.routeNativeElement!.querySelector<HTMLButtonElement>(
        '[data-testid="theme-toggle"]',
      )!;
      return { harness, button };
    }

    it('no tema claro mostra a lua; ao clicar fica escuro, mostra o sol e lembra a escolha', async () => {
      const { harness, button } = await themeButton();
      expect(button.textContent?.trim()).toBe('Ativar modo escuro');
      expect(button.getAttribute('style')).toContain('moon');

      button.click();
      harness.detectChanges();
      expect(button.textContent?.trim()).toBe('Ativar modo claro');
      expect(button.getAttribute('style')).toContain('sun');
      expect(localStorage.getItem('tuiDark')).toBe('true');

      button.click();
      harness.detectChanges();
      expect(button.textContent?.trim()).toBe('Ativar modo escuro');
      expect(localStorage.getItem('tuiDark')).toBe('false');
    });

    it('abre no tema salvo no navegador', async () => {
      localStorage.setItem('tuiDark', 'true');
      const { button } = await themeButton();
      expect(button.textContent?.trim()).toBe('Ativar modo claro');
    });
  });
});
