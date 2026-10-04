import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialog, MatDialogRef } from '@angular/material/dialog';
import { of } from 'rxjs';
import type { Category } from '../../core/api/models';
import { CatalogService } from '../../core/data/catalog.service';
import { all, click, dialogRefMock, fail, one, text, type } from '../../../testing/helpers';
import { CategoriesPage } from './categories.page';
import { CategoryDialog } from './category-dialog';

const category = (over: Partial<Category>): Category => ({
  id: 'c1',
  name: 'Salário',
  type: 'INCOME',
  active: true,
  in_use: false,
  ...over,
});

describe('CategoriesPage', () => {
  const catalog = {
    categories: vi.fn(),
    setCategoryActive: vi.fn(),
  };
  const dialog = { open: vi.fn() };

  beforeEach(() => {
    vi.resetAllMocks();
    catalog.setCategoryActive.mockReturnValue(of({}));
    TestBed.configureTestingModule({
      providers: [
        { provide: CatalogService, useValue: catalog },
        { provide: MatDialog, useValue: dialog },
      ],
    });
  });

  async function render(list: Category[]) {
    catalog.categories.mockReturnValue(of(list));
    const fixture = TestBed.createComponent(CategoriesPage);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture;
  }

  it('separa ativas e inativas por tipo', async () => {
    const fixture = await render([
      category({ id: '1', name: 'Salário' }),
      category({ id: '2', name: 'Alimentação', type: 'EXPENSE' }),
      category({ id: '3', name: 'Antiga', type: 'EXPENSE', active: false }),
    ]);
    const content = text(fixture);
    expect(content).toContain('Ativas');
    expect(content).toContain('Inativas');
    expect(content).toContain('Entradas');
    expect(content).toContain('Saídas');
    expect(all(fixture, '[data-testid="category-row"]')).toHaveLength(3);
  });

  it('mostra o estado vazio', async () => {
    const fixture = await render([]);
    expect(one(fixture, '[data-testid="empty"]').textContent).toContain('Nenhuma categoria');
  });

  it('mostra erro com nova tentativa', async () => {
    catalog.categories.mockReturnValueOnce(fail());
    const fixture = TestBed.createComponent(CategoriesPage);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(text(fixture)).toContain('Não foi possível carregar');
    catalog.categories.mockReturnValue(of([category({})]));
    await click(fixture, one(fixture, '[role="alert"] button'));
    fixture.detectChanges();
    expect(all(fixture, '[data-testid="category-row"]')).toHaveLength(1);
  });

  it('desativa uma categoria ativa e recarrega', async () => {
    const fixture = await render([category({ id: '1' })]);
    await click(fixture, one(fixture, '[data-testid="toggle"]'));
    expect(catalog.setCategoryActive).toHaveBeenCalledWith('1', false);
    expect(catalog.categories).toHaveBeenCalledTimes(2);
  });

  it('reativa uma categoria inativa', async () => {
    const fixture = await render([category({ id: '1', active: false })]);
    expect(one(fixture, '[data-testid="toggle"]').textContent).toContain('Reativar');
    await click(fixture, one(fixture, '[data-testid="toggle"]'));
    expect(catalog.setCategoryActive).toHaveBeenCalledWith('1', true);
  });

  it('abre o diálogo de criação e recarrega ao salvar', async () => {
    dialog.open.mockReturnValue({ afterClosed: () => of(true) });
    const fixture = await render([]);
    await click(fixture, one(fixture, '.page-header button'));
    expect(dialog.open).toHaveBeenCalledWith(
      CategoryDialog,
      expect.objectContaining({ data: null }),
    );
    expect(catalog.categories).toHaveBeenCalledTimes(2);
  });
});

describe('CategoryDialog', () => {
  const catalog = { createCategory: vi.fn(), updateCategory: vi.fn() };

  function setup(data: Category | null) {
    vi.resetAllMocks();
    catalog.createCategory.mockReturnValue(of({}));
    catalog.updateCategory.mockReturnValue(of({}));
    TestBed.configureTestingModule({
      providers: [
        { provide: CatalogService, useValue: catalog },
        { provide: MAT_DIALOG_DATA, useValue: data },
        dialogRefMock(),
      ],
    });
    const fixture = TestBed.createComponent(CategoryDialog);
    fixture.detectChanges();
    return fixture;
  }

  it('cria com nome e tipo', async () => {
    const fixture = setup(null);
    await type(fixture, one(fixture, 'input'), '  Mercado ');
    one<HTMLFormElement>(fixture, 'form').dispatchEvent(new Event('submit'));
    expect(catalog.createCategory).toHaveBeenCalledWith({ name: 'Mercado', type: 'EXPENSE' });
    expect(TestBed.inject(MatDialogRef).close).toHaveBeenCalledWith(true);
  });

  it('não envia nome vazio', async () => {
    const fixture = setup(null);
    one<HTMLFormElement>(fixture, 'form').dispatchEvent(new Event('submit'));
    expect(catalog.createCategory).not.toHaveBeenCalled();
  });

  it('edita só o nome e bloqueia o tipo de categoria em uso', async () => {
    const fixture = setup(category({ id: 'x', name: 'Antigo', in_use: true }));
    expect(text(fixture)).toContain('O tipo não pode mudar');
    await type(fixture, one(fixture, 'input'), 'Novo');
    one<HTMLFormElement>(fixture, 'form').dispatchEvent(new Event('submit'));
    expect(catalog.updateCategory).toHaveBeenCalledWith('x', { name: 'Novo' });
  });
});
