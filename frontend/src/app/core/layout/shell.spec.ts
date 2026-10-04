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
    TestBed.configureTestingModule({
      providers: [provideRouter(routes), provideHttpClient(), provideHttpClientTesting()],
    });
  });

  it('redireciona a raiz para a home', async () => {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/');
    expect(TestBed.inject(Location).path()).toBe('/home');
    expect(harness.routeNativeElement?.querySelector('mat-sidenav')).not.toBeNull();
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

  it('lista todos os itens no menu lateral', async () => {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/home');
    const links = harness.routeNativeElement?.querySelectorAll('mat-sidenav a[mat-list-item]');
    expect(links?.length).toBe(NAV_ITEMS.length);
  });
});
