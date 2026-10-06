import { Type } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideTaiga } from '@taiga-ui/core';
import { of } from 'rxjs';
import type { Category, CreditCard, PaymentMethod, Recurrence } from '../../core/api/models';
import { Clock } from '../../core/clock';
import { CatalogService } from '../../core/data/catalog.service';
import { LedgerService } from '../../core/data/ledger.service';
import { AppDialog } from '../../shared/ui/dialog';
import {
  all,
  answerSummary,
  click,
  dialogProviders,
  one,
  overlay,
  root,
  submitButton,
  summaryRow,
  text,
  tuiRoot,
} from '../../../testing/helpers';
import { PauseDialog } from './pause-dialog';
import { RecurrenceDialog } from './recurrence-dialog';
import { RecurrencesPage } from './recurrences.page';

const recurrence = (over: Partial<Recurrence> = {}): Recurrence => ({
  id: 'r1',
  description: 'Netflix',
  amount: 6000,
  type: 'EXPENSE',
  category: { id: 'c1', name: 'Lazer', type: 'EXPENSE', active: true },
  payment_method: { id: 'pm1', name: 'PIX', kind: 'STANDARD', active: true },
  due_day: 10,
  start_date: '2026-01-10',
  end_date: null,
  status: 'ACTIVE',
  paused_from: null,
  paused_until: null,
  cancelled_at: null,
  ...over,
});

const clock = {
  provide: Clock,
  useValue: { today: () => '2027-01-10', currentMonth: () => '2027-01' },
};

describe('RecurrencesPage', () => {
  const ledger = {
    recurrences: vi.fn(),
    resumeRecurrence: vi.fn(),
    cancelRecurrence: vi.fn(),
  };
  const dialog = { open: vi.fn() };

  beforeEach(() => {
    vi.resetAllMocks();
    ledger.resumeRecurrence.mockReturnValue(of({}));
    ledger.cancelRecurrence.mockReturnValue(of({}));
    dialog.open.mockReturnValue(of(true));
    TestBed.configureTestingModule({
      providers: [
        { provide: LedgerService, useValue: ledger },
        { provide: AppDialog, useValue: dialog },
        provideTaiga({ mode: 'light' }),
      ],
    });
  });

  async function render(list: Recurrence[]) {
    ledger.recurrences.mockReturnValue(of(list));
    tuiRoot();
    const fixture = TestBed.createComponent(RecurrencesPage);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture;
  }

  const rows = (f: ComponentFixture<unknown>) => all(f, '[data-testid="recurrence-row"]');
  async function menu(f: ComponentFixture<unknown>, row: HTMLElement) {
    await click(f, row.querySelector<HTMLElement>('[data-testid="menu"]')!);
    return overlay('[data-testid^="act-"]');
  }
  const ids = (buttons: HTMLElement[]) => buttons.map((b) => b.dataset['testid']);

  it('lista com status, dia e vigência', async () => {
    const fixture = await render([
      recurrence(),
      recurrence({
        id: 'r2',
        description: 'Seguro',
        status: 'PAUSED',
        paused_from: '2027-01-01',
        paused_until: '2027-04-01',
      }),
      recurrence({
        id: 'r3',
        description: 'Antiga',
        status: 'CANCELLED',
        cancelled_at: '2026-12-01',
      }),
    ]);
    expect(rows(fixture)).toHaveLength(3);
    expect(text(fixture)).toContain('todo dia 10');
    expect(rows(fixture)[1].textContent?.replace(/\s+/g, ' ')).toContain(
      'pausada desde 01/01/2027 até 01/04/2027',
    );
    expect(rows(fixture)[2].textContent?.replace(/\s+/g, ' ')).toContain('cancelada em 01/12/2026');
    const labels = rows(fixture).map((r) =>
      r.querySelector('[data-testid="status"]')?.textContent?.trim(),
    );
    expect(labels).toEqual(['Ativa', 'Pausada', 'Cancelada']);
  });

  it('estado vazio', async () => {
    const fixture = await render([]);
    expect(one(fixture, '[data-testid="empty"]').textContent).toContain('Nenhuma recorrência');
  });

  it('ativa: editar, pausar e cancelar', async () => {
    const fixture = await render([recurrence()]);
    expect(ids(await menu(fixture, rows(fixture)[0]))).toEqual([
      'act-edit',
      'act-pause',
      'act-cancel',
    ]);
  });

  it('pausada: editar, retomar e cancelar', async () => {
    const fixture = await render([recurrence({ status: 'PAUSED' })]);
    expect(ids(await menu(fixture, rows(fixture)[0]))).toEqual([
      'act-edit',
      'act-resume',
      'act-cancel',
    ]);
  });

  it('cancelada: sem ações', async () => {
    const fixture = await render([recurrence({ status: 'CANCELLED' })]);
    expect(rows(fixture)[0].querySelector('[data-testid="menu"]')).toBeNull();
  });

  it('retoma a recorrência pausada', async () => {
    const fixture = await render([recurrence({ status: 'PAUSED' })]);
    const buttons = await menu(fixture, rows(fixture)[0]);
    await click(
      fixture,
      buttons.find((b) => b.dataset['testid'] === 'act-resume')!,
    );
    expect(ledger.resumeRecurrence).toHaveBeenCalledWith('r1');
  });

  it('cancela somente após confirmar', async () => {
    const fixture = await render([recurrence()]);
    dialog.open.mockReturnValue(of(false));
    let buttons = await menu(fixture, rows(fixture)[0]);
    await click(
      fixture,
      buttons.find((b) => b.dataset['testid'] === 'act-cancel')!,
    );
    expect(ledger.cancelRecurrence).not.toHaveBeenCalled();

    dialog.open.mockReturnValue(of(true));
    buttons = await menu(fixture, rows(fixture)[0]);
    await click(
      fixture,
      buttons.find((b) => b.dataset['testid'] === 'act-cancel')!,
    );
    expect(ledger.cancelRecurrence).toHaveBeenCalledWith('r1');
  });

  it('abre os diálogos de criação, edição e pausa', async () => {
    const fixture = await render([recurrence()]);
    await click(fixture, one(fixture, '[data-testid="new"]'));
    expect(dialog.open).toHaveBeenLastCalledWith(RecurrenceDialog, null);
    let buttons = await menu(fixture, rows(fixture)[0]);
    await click(
      fixture,
      buttons.find((b) => b.dataset['testid'] === 'act-pause')!,
    );
    expect(dialog.open).toHaveBeenLastCalledWith(PauseDialog, recurrence());
    buttons = await menu(fixture, rows(fixture)[0]);
    await click(
      fixture,
      buttons.find((b) => b.dataset['testid'] === 'act-edit')!,
    );
    expect(dialog.open).toHaveBeenLastCalledWith(RecurrenceDialog, recurrence());
  });
});

const ref = { close: vi.fn() };
function create<T>(component: Type<T>, data: unknown, providers: unknown[]): ComponentFixture<T> {
  TestBed.configureTestingModule({
    providers: [clock, ...dialogProviders(data, ref), ...(providers as never[])],
  });
  const fixture = TestBed.createComponent(component);
  fixture.detectChanges();
  return fixture;
}
const form = (f: ComponentFixture<unknown>) =>
  (f.componentInstance as unknown as { form: import('@angular/forms').FormGroup }).form;
/** Envia o formulário; se abrir o resumo, responde (`null` deixa o resumo aberto). */
const submit = async (f: ComponentFixture<unknown>, answer: boolean | null = true) => {
  one<HTMLFormElement>(f, 'form').dispatchEvent(new Event('submit'));
  f.detectChanges();
  await f.whenStable();
  if (answer !== null) await answerSummary(f, answer);
};

describe('RecurrenceDialog', () => {
  const categories: Category[] = [
    { id: 'c1', name: 'Lazer', type: 'EXPENSE', active: true, in_use: false },
    { id: 'c-in', name: 'Salário', type: 'INCOME', active: true, in_use: false },
    { id: 'c2', name: 'Velha', type: 'EXPENSE', active: false, in_use: false },
  ];
  const methods: PaymentMethod[] = [
    { id: 'pm1', name: 'PIX', source: 'SYSTEM', kind: 'STANDARD', active: true },
    { id: 'pm2', name: 'Nubank', source: 'USER', kind: 'CREDIT_CARD', active: true },
  ];
  const nubank: CreditCard = {
    id: 'k1',
    payment_method_id: 'pm2',
    name: 'Nubank',
    active: true,
    best_purchase_day: 6,
    due_day: 15,
  };
  const catalog = { categories: vi.fn(), paymentMethods: vi.fn(), creditCards: vi.fn() };
  const ledger = {
    createRecurrence: vi.fn(),
    updateRecurrence: vi.fn(),
    postingPreview: vi.fn(),
  };

  async function setup(data: Recurrence | null) {
    vi.resetAllMocks();
    catalog.categories.mockReturnValue(of(categories));
    catalog.paymentMethods.mockReturnValue(of(methods));
    catalog.creditCards.mockReturnValue(of([nubank]));
    ledger.postingPreview.mockReturnValue(
      of({
        reference_month: '2027-02',
        closing_date: '2027-02-06',
        due_date: '2027-02-15',
        persisted: false,
      }),
    );
    ledger.createRecurrence.mockReturnValue(of({}));
    ledger.updateRecurrence.mockReturnValue(of({}));
    const f = create(RecurrenceDialog, data, [
      { provide: CatalogService, useValue: catalog },
      { provide: LedgerService, useValue: ledger },
    ]);
    await f.whenStable();
    return f;
  }

  it('mantém o botão desabilitado até a recorrência ser válida', async () => {
    const f = await setup(null);
    expect(submitButton(f).disabled).toBe(true);
    form(f).patchValue({
      description: 'Aluguel',
      amount: '1.500,00',
      category_id: 'c1',
      payment_method_id: 'pm1',
      due_day: 8,
    });
    f.detectChanges();
    expect(submitButton(f).disabled).toBe(false);
    form(f).patchValue({ due_day: 40 });
    f.detectChanges();
    expect(submitButton(f).disabled).toBe(true);
  });

  const dayLabel = (f: ComponentFixture<unknown>) =>
    all(f, 'label[tuiLabel]')
      .map((l) => l.textContent?.trim())
      .find((t) => t?.startsWith('Dia do') || t?.startsWith('Dia da'));

  it('rótulo do dia: vencimento (conta), recebimento (entrada) e cobrança (cartão)', async () => {
    const f = await setup(null);
    f.detectChanges();
    expect(dayLabel(f)).toBe('Dia do vencimento');
    form(f).patchValue({ category_id: 'c-in' });
    f.detectChanges();
    expect(dayLabel(f)).toBe('Dia do recebimento');
    form(f).patchValue({ payment_method_id: 'pm2' });
    f.detectChanges();
    expect(dayLabel(f)).toBe('Dia da cobrança');
  });

  it('no cartão, a dica mostra a fatura em que a cobrança cairá', async () => {
    const f = await setup(null);
    expect(root(f).querySelector('[data-testid="card-hint"]')).toBeNull();
    form(f).patchValue({ payment_method_id: 'pm2', due_day: 10 });
    f.detectChanges();
    await f.whenStable();
    f.detectChanges();
    // hoje = 10/01/2027: a próxima cobrança no dia 10 é hoje
    expect(ledger.postingPreview).toHaveBeenCalledWith('k1', '2027-01-10');
    expect(one(f, '[data-testid="card-hint"]').textContent).toContain(
      'cairá na fatura de fevereiro/2027 (vence 15/02/2027)',
    );
    form(f).patchValue({ due_day: 5 });
    f.detectChanges();
    await f.whenStable();
    expect(ledger.postingPreview).toHaveBeenLastCalledWith('k1', '2027-02-05');
  });

  it('mostra o resumo e só grava ao confirmar', async () => {
    const f = await setup(null);
    form(f).patchValue({
      description: 'Aluguel',
      amount: '1.500,00',
      category_id: 'c1',
      payment_method_id: 'pm1',
      due_day: 8,
    });
    await submit(f, null);
    expect(summaryRow('Descrição')).toBe('Aluguel');
    expect(summaryRow('Categoria')).toBe('Lazer');
    expect(summaryRow('Término')).toBe('Sem término');
    await answerSummary(f, false);
    expect(ledger.createRecurrence).not.toHaveBeenCalled();
    await submit(f);
    expect(ledger.createRecurrence).toHaveBeenCalledTimes(1);
  });

  it('cria recorrência com início hoje e sem término', async () => {
    const f = await setup(null);
    form(f).patchValue({
      description: ' Aluguel ',
      amount: '1.500,00',
      category_id: 'c1',
      payment_method_id: 'pm1',
      due_day: 8,
    });
    await submit(f);
    expect(ledger.createRecurrence).toHaveBeenCalledWith({
      description: 'Aluguel',
      amount: 150000,
      category_id: 'c1',
      payment_method_id: 'pm1',
      due_day: 8,
      start_date: '2027-01-10',
    });
    expect(ref.close).toHaveBeenCalledWith(true);
  });

  it('envia o término quando informado', async () => {
    const f = await setup(null);
    form(f).patchValue({
      description: 'Curso',
      amount: '100',
      category_id: 'c1',
      payment_method_id: 'pm2',
      due_day: 5,
      end_date: '2027-12-31',
    });
    await submit(f);
    expect(ledger.createRecurrence).toHaveBeenCalledWith(
      expect.objectContaining({ end_date: '2027-12-31' }),
    );
  });

  it.each([0, 32])('rejeita dia de vencimento %i', async (day) => {
    const f = await setup(null);
    form(f).patchValue({
      description: 'X',
      amount: '10',
      category_id: 'c1',
      payment_method_id: 'pm1',
      due_day: day,
    });
    await submit(f);
    expect(ledger.createRecurrence).not.toHaveBeenCalled();
  });

  it('edita sem pedir início e avisa que só vale para ocorrências futuras', async () => {
    const f = await setup(recurrence());
    expect(one(f, '[data-testid="edit-hint"]').textContent).toContain('ainda não geradas');
    expect(text(f)).not.toContain('Início');
    form(f).patchValue({ amount: '70,00' });
    await submit(f);
    expect(ledger.updateRecurrence).toHaveBeenCalledWith('r1', {
      description: 'Netflix',
      amount: 7000,
      category_id: 'c1',
      payment_method_id: 'pm1',
      due_day: 10,
      end_date: null,
    });
  });

  it('só lista categorias ativas na criação', async () => {
    const f = await setup(null);
    const c = f.componentInstance as unknown as { categoryOptions: () => Category[] };
    expect(c.categoryOptions().map((x) => x.id)).toEqual(['c1', 'c-in']);
  });
});

describe('PauseDialog', () => {
  const ledger = { pauseRecurrence: vi.fn() };
  const setup = () => {
    vi.resetAllMocks();
    ledger.pauseRecurrence.mockReturnValue(of({}));
    return create(PauseDialog, recurrence(), [{ provide: LedgerService, useValue: ledger }]);
  };

  it('desabilita o botão sem a data de início', () => {
    const f = setup();
    expect(submitButton(f).disabled).toBe(false);
    form(f).patchValue({ paused_from: '' });
    f.detectChanges();
    expect(submitButton(f).disabled).toBe(true);
  });

  it('pausa a partir de hoje, sem retorno', async () => {
    const f = setup();
    await submit(f);
    expect(ledger.pauseRecurrence).toHaveBeenCalledWith('r1', { paused_from: '2027-01-10' });
    expect(ref.close).toHaveBeenCalledWith(true);
  });

  it('pausa com início e retorno', async () => {
    const f = setup();
    form(f).patchValue({ paused_from: '2027-02-01', paused_until: '2027-04-01' });
    await submit(f);
    expect(ledger.pauseRecurrence).toHaveBeenCalledWith('r1', {
      paused_from: '2027-02-01',
      paused_until: '2027-04-01',
    });
  });
});
