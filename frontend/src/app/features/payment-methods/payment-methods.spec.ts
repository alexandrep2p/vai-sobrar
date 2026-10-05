import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialog, MatDialogRef } from '@angular/material/dialog';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import type { PaymentMethod } from '../../core/api/models';
import { CatalogService } from '../../core/data/catalog.service';
import { all, click, dialogRefMock, one, submitButton, text, type } from '../../../testing/helpers';
import { MethodDialog } from './method-dialog';
import { PaymentMethodsPage } from './payment-methods.page';

const method = (over: Partial<PaymentMethod>): PaymentMethod => ({
  id: 'm1',
  name: 'PIX',
  source: 'SYSTEM',
  kind: 'STANDARD',
  active: true,
  ...over,
});

describe('PaymentMethodsPage', () => {
  const catalog = { paymentMethods: vi.fn(), setPaymentMethodActive: vi.fn() };
  const dialog = { open: vi.fn() };

  beforeEach(() => {
    vi.resetAllMocks();
    catalog.setPaymentMethodActive.mockReturnValue(of({}));
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: CatalogService, useValue: catalog },
        { provide: MatDialog, useValue: dialog },
      ],
    });
  });

  async function render(list: PaymentMethod[]) {
    catalog.paymentMethods.mockReturnValue(of(list));
    const fixture = TestBed.createComponent(PaymentMethodsPage);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture;
  }

  const rows = (f: Awaited<ReturnType<typeof render>>) => all(f, '[data-testid="method-row"]');

  it('mostra origem e tipo e separa ativos de inativos', async () => {
    const fixture = await render([
      method({ id: '1', name: 'PIX' }),
      method({ id: '2', name: 'Vale', source: 'USER', active: false }),
      method({ id: '3', name: 'Nubank', source: 'USER', kind: 'CREDIT_CARD' }),
    ]);
    const content = text(fixture);
    expect(content).toContain('Sistema · Comum');
    expect(content).toContain('Personalizado · Cartão de crédito');
    expect(content).toContain('Ativos');
    expect(content).toContain('Inativos');
  });

  it('respeita a tabela de ações por tipo de método', async () => {
    const fixture = await render([
      method({ id: '1', name: 'PIX' }),
      method({ id: '2', name: 'Vale', source: 'USER' }),
      method({ id: '3', name: 'Nubank', source: 'USER', kind: 'CREDIT_CARD' }),
    ]);
    const [system, custom, card] = rows(fixture);
    // Sistema: só desativar (sem editar).
    expect(system.querySelector('[data-testid="edit"]')).toBeNull();
    expect(system.querySelector('[data-testid="toggle"]')).not.toBeNull();
    // Personalizado: editar e desativar.
    expect(custom.querySelector('[data-testid="edit"]')).not.toBeNull();
    // Cartão: edita pelo fluxo de cartão, mas pode ser desativado.
    expect(card.querySelector('[data-testid="edit"]')).toBeNull();
    expect(card.querySelector('[data-testid="card-link"]')?.getAttribute('href')).toBe('/cartoes');
    expect(card.querySelector('[data-testid="toggle"]')).not.toBeNull();
  });

  it('ativa e desativa qualquer método', async () => {
    const fixture = await render([
      method({ id: '1' }),
      method({ id: '2', name: 'Velho', active: false }),
    ]);
    const [active, inactive] = rows(fixture);
    await click(fixture, active.querySelector<HTMLElement>('[data-testid="toggle"]')!);
    expect(catalog.setPaymentMethodActive).toHaveBeenCalledWith('1', false);
    await click(fixture, inactive.querySelector<HTMLElement>('[data-testid="toggle"]')!);
    expect(catalog.setPaymentMethodActive).toHaveBeenCalledWith('2', true);
  });

  it('abre o diálogo de criação', async () => {
    dialog.open.mockReturnValue({ afterClosed: () => of(true) });
    const fixture = await render([method({})]);
    await click(fixture, one(fixture, '.page-header button'));
    expect(dialog.open).toHaveBeenCalledWith(MethodDialog, expect.objectContaining({ data: null }));
  });
});

describe('MethodDialog', () => {
  const catalog = { createPaymentMethod: vi.fn(), updatePaymentMethod: vi.fn() };

  function setup(data: PaymentMethod | null) {
    vi.resetAllMocks();
    catalog.createPaymentMethod.mockReturnValue(of({}));
    catalog.updatePaymentMethod.mockReturnValue(of({}));
    TestBed.configureTestingModule({
      providers: [
        { provide: CatalogService, useValue: catalog },
        { provide: MAT_DIALOG_DATA, useValue: data },
        dialogRefMock(),
      ],
    });
    const fixture = TestBed.createComponent(MethodDialog);
    fixture.detectChanges();
    return fixture;
  }

  it('cria método comum', async () => {
    const fixture = setup(null);
    await type(fixture, one(fixture, 'input'), 'Vale-refeição');
    one<HTMLFormElement>(fixture, 'form').dispatchEvent(new Event('submit'));
    expect(catalog.createPaymentMethod).toHaveBeenCalledWith({ name: 'Vale-refeição' });
    expect(TestBed.inject(MatDialogRef).close).toHaveBeenCalledWith(true);
  });

  it('mantém o botão desabilitado enquanto o nome estiver vazio', async () => {
    const fixture = setup(null);
    expect(submitButton(fixture).disabled).toBe(true);
    await type(fixture, one(fixture, 'input'), 'Vale');
    expect(submitButton(fixture).disabled).toBe(false);
  });

  it('edita o nome do método personalizado', async () => {
    const fixture = setup(method({ id: 'z', name: 'Vale', source: 'USER' }));
    await type(fixture, one(fixture, 'input'), 'Vale novo');
    one<HTMLFormElement>(fixture, 'form').dispatchEvent(new Event('submit'));
    expect(catalog.updatePaymentMethod).toHaveBeenCalledWith('z', { name: 'Vale novo' });
  });
});
