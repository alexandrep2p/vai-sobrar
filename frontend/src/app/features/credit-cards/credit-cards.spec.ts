import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialog, MatDialogRef } from '@angular/material/dialog';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import type { CreditCard } from '../../core/api/models';
import { CatalogService } from '../../core/data/catalog.service';
import { all, click, dialogRefMock, one, submitButton, text, type } from '../../../testing/helpers';
import { CardDialog } from './card-dialog';
import { CreditCardsPage } from './credit-cards.page';

const card = (over: Partial<CreditCard> = {}): CreditCard => ({
  id: 'k1',
  payment_method_id: 'pm1',
  name: 'Nubank',
  active: true,
  best_purchase_day: 6,
  due_day: 15,
  ...over,
});

describe('CreditCardsPage', () => {
  const catalog = { creditCards: vi.fn(), setCreditCardActive: vi.fn() };
  const dialog = { open: vi.fn() };

  beforeEach(() => {
    vi.resetAllMocks();
    catalog.setCreditCardActive.mockReturnValue(of({}));
    dialog.open.mockReturnValue({ afterClosed: () => of(true) });
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: CatalogService, useValue: catalog },
        { provide: MatDialog, useValue: dialog },
      ],
    });
  });

  async function render(list: CreditCard[]) {
    catalog.creditCards.mockReturnValue(of(list));
    const fixture = TestBed.createComponent(CreditCardsPage);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture;
  }

  it('lista cartões com melhor dia e vencimento', async () => {
    const fixture = await render([card(), card({ id: 'k2', name: 'Velho', active: false })]);
    expect(all(fixture, '[data-testid="card-row"]')).toHaveLength(2);
    expect(text(fixture)).toContain('Melhor dia de compra: 6 · Vencimento: dia 15');
  });

  it('estado vazio', async () => {
    const fixture = await render([]);
    expect(one(fixture, '[data-testid="empty"]').textContent).toContain('Nenhum cartão');
  });

  it('ativa e desativa o cartão', async () => {
    const fixture = await render([card()]);
    await click(fixture, one(fixture, '[data-testid="toggle"]'));
    expect(catalog.setCreditCardActive).toHaveBeenCalledWith('k1', false);
  });

  it('abre o diálogo para editar', async () => {
    const fixture = await render([card()]);
    await click(fixture, one(fixture, '[data-testid="edit"]'));
    expect(dialog.open).toHaveBeenCalledWith(CardDialog, expect.objectContaining({ data: card() }));
  });
});

describe('CardDialog', () => {
  const catalog = { createCreditCard: vi.fn(), updateCreditCard: vi.fn() };

  function setup(data: CreditCard | null) {
    vi.resetAllMocks();
    catalog.createCreditCard.mockReturnValue(of({}));
    catalog.updateCreditCard.mockReturnValue(of({}));
    TestBed.configureTestingModule({
      providers: [
        { provide: CatalogService, useValue: catalog },
        { provide: MAT_DIALOG_DATA, useValue: data },
        dialogRefMock(),
      ],
    });
    const fixture = TestBed.createComponent(CardDialog);
    fixture.detectChanges();
    return fixture;
  }

  const submit = (f: ReturnType<typeof setup>) =>
    one<HTMLFormElement>(f, 'form').dispatchEvent(new Event('submit'));

  it('mantém o botão desabilitado até o cartão ser válido', async () => {
    const fixture = setup(null);
    const [name, best, due] = all<HTMLInputElement>(fixture, 'input');
    expect(submitButton(fixture).disabled).toBe(true);
    await type(fixture, name, 'Inter');
    await type(fixture, best, '6');
    await type(fixture, due, '15');
    expect(submitButton(fixture).disabled).toBe(false);
    await type(fixture, due, '45');
    expect(submitButton(fixture).disabled).toBe(true);
  });

  it('cadastra o cartão com os dias informados', async () => {
    const fixture = setup(null);
    const [name, best, due] = all<HTMLInputElement>(fixture, 'input');
    await type(fixture, name, 'Inter');
    await type(fixture, best, '6');
    await type(fixture, due, '15');
    submit(fixture);
    expect(catalog.createCreditCard).toHaveBeenCalledWith({
      name: 'Inter',
      best_purchase_day: 6,
      due_day: 15,
    });
    expect(TestBed.inject(MatDialogRef).close).toHaveBeenCalledWith(true);
  });

  it.each([
    ['0', '15'],
    ['32', '15'],
    ['6', '0'],
    ['6', '45'],
    ['', '15'],
  ])('rejeita dia fora de 1–31 (%s, %s)', async (best, due) => {
    const fixture = setup(null);
    const [name, bestInput, dueInput] = all<HTMLInputElement>(fixture, 'input');
    await type(fixture, name, 'Inter');
    await type(fixture, bestInput, best);
    await type(fixture, dueInput, due);
    submit(fixture);
    expect(catalog.createCreditCard).not.toHaveBeenCalled();
  });

  it('edita e avisa que a mudança vale só para ciclos futuros', async () => {
    const fixture = setup(card());
    expect(one(fixture, '[data-testid="future-warning"]').textContent).toContain('ciclos futuros');
    await type(fixture, all<HTMLInputElement>(fixture, 'input')[2], '20');
    submit(fixture);
    expect(catalog.updateCreditCard).toHaveBeenCalledWith('k1', {
      name: 'Nubank',
      best_purchase_day: 6,
      due_day: 20,
    });
  });

  it('não mostra o aviso ao criar', () => {
    const fixture = setup(null);
    expect(root(fixture).querySelector('[data-testid="future-warning"]')).toBeNull();
  });
});

function root(fixture: { nativeElement: unknown }): HTMLElement {
  return fixture.nativeElement as HTMLElement;
}
