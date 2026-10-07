import { Location } from '@angular/common';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { provideRouter } from '@angular/router';
import { routes } from '../../app.routes';
import { AuthStore, type User } from '../auth/auth.store';
import { NAV_ITEMS } from './nav-items';

const USER: User = { id: 'u1', name: 'Ana Souza', username: 'Ana.Souza', email: 'ana@x.com' };

describe('navegação', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideRouter(routes), provideHttpClient(), provideHttpClientTesting()],
    });
  });

  describe('conectado', () => {
    beforeEach(() => TestBed.inject(AuthStore).set(USER));

    it('redireciona a raiz para a home', async () => {
      const harness = await RouterTestingHarness.create();
      await harness.navigateByUrl('/');
      expect(TestBed.inject(Location).path()).toBe('/home');
      expect(harness.routeNativeElement?.querySelector('mat-sidenav')).not.toBeNull();
    });

    it('abre cada rota do menu e Minha conta', async () => {
      const harness = await RouterTestingHarness.create();
      const router = TestBed.inject(Router);
      for (const path of [...NAV_ITEMS.map((i) => i.path), '/conta']) {
        await harness.navigateByUrl(path);
        expect(router.url).toBe(path);
        expect(harness.routeNativeElement?.querySelector('main')).not.toBeNull();
      }
    });

    it('lista os itens do menu, o usuário, Minha conta e Sair', async () => {
      const harness = await RouterTestingHarness.create();
      await harness.navigateByUrl('/home');
      const root = harness.routeNativeElement!;
      const links = root.querySelectorAll('mat-sidenav a[mat-list-item]');
      expect(links.length).toBe(NAV_ITEMS.length + 1);
      const account = root.querySelector('[data-testid="account"]')?.textContent ?? '';
      expect(account).toContain('Ana Souza');
      expect(account).toContain('@Ana.Souza');
      expect(root.textContent).toContain('Minha conta');
      expect(root.querySelector('[data-testid="logout"]')).not.toBeNull();
    });

    it('Sair encerra a sessão e volta ao login', async () => {
      const harness = await RouterTestingHarness.create();
      await harness.navigateByUrl('/home');
      const http = TestBed.inject(HttpTestingController);
      harness
        .routeNativeElement!.querySelector<HTMLButtonElement>('[data-testid="logout"]')!
        .click();
      http.expectOne({ method: 'POST', url: '/api/auth/logout' }).flush(null, {
        status: 204,
        statusText: 'No Content',
      });
      await harness.fixture.whenStable();
      expect(TestBed.inject(AuthStore).user()).toBeNull();
      expect(TestBed.inject(Location).path()).toBe('/login');
    });

    it('login e cadastro redirecionam quem já está conectado', async () => {
      const harness = await RouterTestingHarness.create();
      await harness.navigateByUrl('/login');
      expect(TestBed.inject(Location).path()).toBe('/home');
      await harness.navigateByUrl('/cadastro');
      expect(TestBed.inject(Location).path()).toBe('/home');
    });
  });

  describe('sem sessão', () => {
    beforeEach(() => TestBed.inject(AuthStore).set(null));

    it('telas da aplicação levam ao login guardando o destino', async () => {
      const harness = await RouterTestingHarness.create();
      await harness.navigateByUrl('/faturas');
      expect(TestBed.inject(Location).path()).toBe('/login?returnUrl=%2Ffaturas');
      expect(harness.routeNativeElement?.querySelector('mat-sidenav')).toBeNull();
    });

    it('a raiz leva ao login sem destino', async () => {
      const harness = await RouterTestingHarness.create();
      await harness.navigateByUrl('/');
      expect(TestBed.inject(Location).path()).toBe('/login');
    });

    it('login e cadastro abrem normalmente', async () => {
      const harness = await RouterTestingHarness.create();
      await harness.navigateByUrl('/cadastro');
      expect(TestBed.inject(Location).path()).toBe('/cadastro');
      expect(harness.routeNativeElement?.textContent).toContain('Criar conta');
    });
  });
});
