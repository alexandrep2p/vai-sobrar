import { Type } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { ApiError } from '../../core/api/api-error';
import type { Category, PaymentMethod } from '../../core/api/models';
import { Clock } from '../../core/clock';
import { CatalogService } from '../../core/data/catalog.service';
import { LedgerService } from '../../core/data/ledger.service';
import { PayDialog } from '../../shared/ui/pay-dialog';
import {
  cardItem,
  installmentItem,
  projectedItem,
  recurrenceItem,
  statementItem,
} from '../../../testing/fixtures';
import {
  all,
  answerSummary,
  dialogProviders,
  one,
  submitButton,
  summaryRow,
  text,
  type,
} from '../../../testing/helpers';
import { CloseMonthDialog } from './close-month-dialog';
import { RefundDialog } from './refund-dialog';
import { TransactionEditDialog } from './transaction-edit-dialog';
import { TransactionFormDialog } from './transaction-form-dialog';

const clock = {
  provide: Clock,
  useValue: { today: () => '2027-01-10', currentMonth: () => '2027-01' },
};
const ref = { close: vi.fn() };

function create<T>(component: Type<T>, data: unknown, providers: unknown[]): ComponentFixture<T> {
  TestBed.configureTestingModule({
    providers: [clock, ...dialogProviders(data, ref), ...(providers as never[])],
  });
  const fixture = TestBed.createComponent(component);
  fixture.detectChanges();
  return fixture;
}

const form = (fixture: ComponentFixture<unknown>) =>
  (fixture.componentInstance as unknown as { form: import('@angular/forms').FormGroup }).form;

/** Envia o formulário; se abrir o resumo, responde (`null` deixa o resumo aberto). */
const submit = async (fixture: ComponentFixture<unknown>, answer: boolean | null = true) => {
  one<HTMLFormElement>(fixture, 'form').dispatchEvent(new Event('submit'));
  fixture.detectChanges();
  await fixture.whenStable();
  if (answer !== null) await answerSummary(fixture, answer);
};

beforeEach(() => vi.resetAllMocks());

describe('TransactionFormDialog (T-40)', () => {
  const categories: Category[] = [
    { id: 'c-in', name: 'Salário', type: 'INCOME', active: true, in_use: false },
    { id: 'c-out', name: 'Mercado', type: 'EXPENSE', active: true, in_use: false },
    { id: 'c-old', name: 'Antiga', type: 'EXPENSE', active: false, in_use: false },
  ];
  const methods: PaymentMethod[] = [
    { id: 'm-pix', name: 'PIX', source: 'SYSTEM', kind: 'STANDARD', active: true },
    { id: 'm-card', name: 'Nubank', source: 'USER', kind: 'CREDIT_CARD', active: true },
    { id: 'm-off', name: 'Vale', source: 'USER', kind: 'STANDARD', active: false },
  ];
  const catalog = { categories: vi.fn(), paymentMethods: vi.fn(), creditCards: vi.fn() };
  const ledger = { createTransaction: vi.fn(), postingPreview: vi.fn() };

  async function setup() {
    catalog.categories.mockReturnValue(of(categories));
    catalog.paymentMethods.mockReturnValue(of(methods));
    catalog.creditCards.mockReturnValue(
      of([
        {
          id: 'k1',
          payment_method_id: 'm-card',
          name: 'Nubank',
          active: true,
          best_purchase_day: 6,
          due_day: 15,
        },
      ]),
    );
    ledger.postingPreview.mockReturnValue(
      of({
        reference_month: '2026-12',
        closing_date: '2026-12-06',
        due_date: '2026-12-15',
        persisted: false,
      }),
    );
    ledger.createTransaction.mockReturnValue(of({}));
    const fixture = create(TransactionFormDialog, null, [
      { provide: CatalogService, useValue: catalog },
      { provide: LedgerService, useValue: ledger },
    ]);
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture;
  }

  const fill = async (f: ComponentFixture<unknown>, values: Record<string, unknown>) => {
    form(f).patchValue(values);
    f.detectChanges();
    await f.whenStable();
  };

  it('cria lançamento manual com data de vencimento', async () => {
    const f = await setup();
    await fill(f, {
      description: ' Luz ',
      amount: '1.234,56',
      category_id: 'c-out',
      payment_method_id: 'm-pix',
      date: '2027-01-20',
    });
    await submit(f);
    expect(ledger.createTransaction).toHaveBeenCalledWith({
      description: 'Luz',
      amount: 123456,
      category_id: 'c-out',
      payment_method_id: 'm-pix',
      due_date: '2027-01-20',
    });
    expect(ref.close).toHaveBeenCalledWith(true);
  });

  it('mostra o resumo antes de gravar e só grava ao confirmar', async () => {
    const f = await setup();
    await fill(f, {
      description: 'Coxim',
      amount: '590,00',
      category_id: 'c-out',
      payment_method_id: 'm-card',
      date: '2026-11-28',
      installments: 10,
    });
    await submit(f, null);
    expect(summaryRow('Descrição')).toBe('Coxim');
    expect(summaryRow('Categoria')).toBe('Mercado');
    expect(summaryRow('Método')).toBe('Nubank');
    expect(summaryRow('Data da compra')).toBe('28/11/2026');
    expect(summaryRow('Parcelas')?.replace(/\s/g, ' ')).toBe('10x de R$ 59,00');
    expect(ledger.postingPreview).toHaveBeenCalledWith('k1', '2026-11-28');
    expect(summaryRow('Primeira fatura')).toBe('dezembro/2026 (vence 15/12/2026)');
    await answerSummary(f, false);
    expect(ledger.createTransaction).not.toHaveBeenCalled();
    expect(ref.close).not.toHaveBeenCalled();
    await submit(f);
    expect(ledger.createTransaction).toHaveBeenCalledTimes(1);
  });

  it('compra à vista no cartão envia a data da compra e não envia parcelas', async () => {
    const f = await setup();
    await fill(f, {
      description: 'Supermercado',
      amount: '640',
      category_id: 'c-out',
      payment_method_id: 'm-card',
      date: '2027-01-08',
      installments: 1,
    });
    await submit(f);
    expect(ledger.createTransaction).toHaveBeenCalledWith({
      description: 'Supermercado',
      amount: 64000,
      category_id: 'c-out',
      payment_method_id: 'm-card',
      purchase_date: '2027-01-08',
    });
  });

  it('compra parcelada envia a quantidade de parcelas', async () => {
    const f = await setup();
    await fill(f, {
      description: 'Coxim',
      amount: '590,00',
      category_id: 'c-out',
      payment_method_id: 'm-card',
      date: '2026-11-28',
      installments: 10,
    });
    await submit(f);
    expect(ledger.createTransaction).toHaveBeenCalledWith({
      description: 'Coxim',
      amount: 59000,
      category_id: 'c-out',
      payment_method_id: 'm-card',
      purchase_date: '2026-11-28',
      installment_count: 10,
    });
  });

  it('só mostra parcelas para método de cartão', async () => {
    const f = await setup();
    expect(text(f)).not.toContain('Parcelas');
    await fill(f, { payment_method_id: 'm-card' });
    expect(text(f)).toContain('Parcelas');
    expect(text(f)).toContain('Data da compra');
  });

  it('lista só métodos ativos e categorias ativas do tipo escolhido', async () => {
    const f = await setup();
    const c = f.componentInstance as unknown as {
      methods: () => PaymentMethod[];
      categoryOptions: () => Category[];
    };
    expect(c.methods().map((m) => m.id)).toEqual(['m-pix', 'm-card']);
    expect(c.categoryOptions().map((x) => x.id)).toEqual(['c-out']);
    await fill(f, { type: 'INCOME' });
    expect(c.categoryOptions().map((x) => x.id)).toEqual(['c-in']);
  });

  it('trocar o tipo limpa a categoria escolhida', async () => {
    const f = await setup();
    await fill(f, { category_id: 'c-out' });
    await fill(f, { type: 'INCOME' });
    expect(form(f).value.category_id).toBe('');
  });

  it('mantém o botão desabilitado até o formulário ficar válido', async () => {
    const f = await setup();
    expect(submitButton(f).disabled).toBe(true);
    await fill(f, {
      description: 'Luz',
      amount: '10,00',
      category_id: 'c-out',
      payment_method_id: 'm-pix',
    });
    expect(submitButton(f).disabled).toBe(false);
    await fill(f, { amount: '' });
    expect(submitButton(f).disabled).toBe(true);
  });

  it('aplica a máscara ao digitar o valor', async () => {
    const f = await setup();
    const input = one<HTMLInputElement>(f, 'input[formControlName="amount"]');
    await type(f, input, '123456');
    expect(input.value).toBe('1.234,56');
    expect(form(f).value.amount).toBe('1234,56');
  });

  it('não envia valor inválido', async () => {
    const f = await setup();
    await fill(f, {
      description: 'X',
      amount: '0',
      category_id: 'c-out',
      payment_method_id: 'm-pix',
    });
    await submit(f);
    expect(ledger.createTransaction).not.toHaveBeenCalled();
  });
});

describe('TransactionEditDialog (T-41)', () => {
  const catalog = { categories: vi.fn(), paymentMethods: vi.fn() };
  const ledger = { updateTransaction: vi.fn(), updatePlan: vi.fn(), editOccurrence: vi.fn() };

  function setup(item = statementItem()) {
    catalog.categories.mockReturnValue(of([]));
    catalog.paymentMethods.mockReturnValue(of([]));
    for (const m of Object.values(ledger)) m.mockReturnValue(of({}));
    return create(TransactionEditDialog, item, [
      { provide: CatalogService, useValue: catalog },
      { provide: LedgerService, useValue: ledger },
    ]);
  }

  const labels = (f: ComponentFixture<unknown>) =>
    all(f, 'mat-label').map((l) => l.textContent?.trim());

  it('manual: edita descrição, valor, vencimento, categoria e método', () => {
    expect(labels(setup())).toEqual([
      'Descrição',
      'Valor (R$)',
      'Vencimento',
      'Categoria',
      'Método de pagamento',
    ]);
  });

  it('compra de cartão: só descrição e categoria', () => {
    expect(labels(setup(cardItem()))).toEqual(['Descrição', 'Categoria']);
  });

  it('ocorrência de recorrência: sem categoria', () => {
    expect(labels(setup(recurrenceItem()))).toEqual([
      'Descrição',
      'Valor (R$)',
      'Vencimento',
      'Método de pagamento',
    ]);
  });

  it('parcela: avisa que vale para o plano inteiro', () => {
    const f = setup(installmentItem());
    expect(one(f, '[data-testid="plan-hint"]').textContent).toContain('todas as parcelas');
  });

  it('mantém o botão desabilitado com valor vazio', async () => {
    const f = setup();
    expect(submitButton(f).disabled).toBe(false);
    form(f).patchValue({ amount: '' });
    f.detectChanges();
    expect(submitButton(f).disabled).toBe(true);
  });

  it('resume as alterações (antes → depois) e não grava se voltar', async () => {
    const item = statementItem();
    const f = setup(item);
    form(f).patchValue({ description: 'Novo nome', amount: '12,34' });
    await submit(f, null);
    expect(summaryRow('Descrição')).toBe(`${item.description} → Novo nome`);
    expect(summaryRow('Valor')).toContain('→');
    await answerSummary(f, false);
    expect(ledger.updateTransaction).not.toHaveBeenCalled();
    await submit(f);
    expect(ledger.updateTransaction).toHaveBeenCalledTimes(1);
  });

  it('envia só os campos alterados do lançamento manual', async () => {
    const f = setup();
    form(f).patchValue({ description: 'Aluguel de janeiro', amount: '1.600,00' });
    await submit(f);
    expect(ledger.updateTransaction).toHaveBeenCalledWith('t1', {
      description: 'Aluguel de janeiro',
      amount: 160000,
    });
    expect(ref.close).toHaveBeenCalledWith(true);
  });

  it('não chama a API quando nada mudou', async () => {
    const f = setup();
    await submit(f);
    expect(ledger.updateTransaction).not.toHaveBeenCalled();
    expect(ref.close).toHaveBeenCalledWith(false);
  });

  it('parcela é editada pelo plano', async () => {
    const f = setup(installmentItem());
    form(f).patchValue({ description: 'Coxim novo' });
    await submit(f);
    expect(ledger.updatePlan).toHaveBeenCalledWith('plan1', { description: 'Coxim novo' });
  });

  it('ocorrência (gerada ou projetada) é editada pelo endpoint da ocorrência', async () => {
    const f = setup(projectedItem());
    form(f).patchValue({ amount: '130,00' });
    await submit(f);
    expect(ledger.editOccurrence).toHaveBeenCalledWith('rec1', '2027-01', { amount: 13000 });
  });

  it('compra de cartão edita só a descrição pelo lançamento', async () => {
    const f = setup(cardItem());
    form(f).patchValue({ description: 'Mercado' });
    await submit(f);
    expect(ledger.updateTransaction).toHaveBeenCalledWith('t-card', { description: 'Mercado' });
  });
});

describe('RefundDialog (T-43)', () => {
  const ledger = {
    transactionRefunds: vi.fn(),
    planRefunds: vi.fn(),
    createRefund: vi.fn(),
  };
  const summary = (over = {}) => ({
    original_amount: 64000,
    refunded_amount: 0,
    refundable_amount: 64000,
    refund_status: null,
    ...over,
  });

  function setup(data: object, s = summary()) {
    ledger.transactionRefunds.mockReturnValue(of(s));
    ledger.planRefunds.mockReturnValue(of(s));
    ledger.createRefund.mockReturnValue(of({}));
    return create(RefundDialog, data, [{ provide: LedgerService, useValue: ledger }]);
  }

  it('mostra o saldo estornável e sugere o estorno total', () => {
    const f = setup({ description: 'Supermercado', transactionId: 't-card' });
    expect(one(f, '[data-testid="refundable"]').textContent).toContain('640,00');
    expect(form(f).value.amount).toBe('640,00');
  });

  it('estorno total da compra à vista', async () => {
    const f = setup({ description: 'Supermercado', transactionId: 't-card' });
    await submit(f);
    expect(ledger.createRefund).toHaveBeenCalledWith({
      transaction_id: 't-card',
      amount: 64000,
      refund_date: '2027-01-10',
    });
  });

  it('estorno parcial', async () => {
    const f = setup({ description: 'Supermercado', transactionId: 't-card' });
    form(f).patchValue({ amount: '100,00' });
    await submit(f);
    expect(ledger.createRefund).toHaveBeenCalledWith(expect.objectContaining({ amount: 10000 }));
  });

  it('compra parcelada envia o plano e a estratégia', async () => {
    const f = setup({ description: 'Coxim', planId: 'plan1' });
    form(f).patchValue({ amount: '200,00', strategy: 'PROPORTIONAL' });
    await submit(f);
    expect(ledger.createRefund).toHaveBeenCalledWith({
      installment_plan_id: 'plan1',
      amount: 20000,
      refund_date: '2027-01-10',
      strategy: 'PROPORTIONAL',
    });
    expect(text(f)).toContain('Estratégia');
  });

  it('compra à vista não pede estratégia', () => {
    const f = setup({ description: 'x', transactionId: 't' });
    expect(text(f)).not.toContain('Estratégia');
  });

  it('exibe a situação de compra parcialmente estornada', () => {
    const f = setup(
      { description: 'x', transactionId: 't' },
      summary({
        refunded_amount: 10000,
        refundable_amount: 54000,
        refund_status: 'PARTIALLY_REFUNDED',
      }),
    );
    expect(one(f, '[data-testid="refund-status"]').textContent).toContain('Parcialmente estornada');
  });

  it('mantém o botão desabilitado com valor vazio', () => {
    const f = setup({ description: 'x', transactionId: 't' });
    expect(submitButton(f).disabled).toBe(false);
    form(f).patchValue({ amount: '' });
    f.detectChanges();
    expect(submitButton(f).disabled).toBe(true);
  });

  it('mostra o resumo do estorno e só grava ao confirmar', async () => {
    const f = setup({ description: 'Supermercado', transactionId: 't-card' });
    form(f).patchValue({ amount: '100,00', refund_date: '2027-01-08' });
    await submit(f, null);
    expect(summaryRow('Compra')).toBe('Supermercado');
    expect(summaryRow('Data do estorno')).toBe('08/01/2027');
    await answerSummary(f, false);
    expect(ledger.createRefund).not.toHaveBeenCalled();
    await submit(f);
    expect(ledger.createRefund).toHaveBeenCalledTimes(1);
  });

  it('não envia valor zero', async () => {
    const f = setup({ description: 'x', transactionId: 't' });
    form(f).patchValue({ amount: '0' });
    await submit(f);
    expect(ledger.createRefund).not.toHaveBeenCalled();
  });
});

describe('CloseMonthDialog (T-45)', () => {
  const ledger = { closeMonth: vi.fn() };
  const setup = () =>
    create(CloseMonthDialog, '2027-01', [{ provide: LedgerService, useValue: ledger }]);

  it('pede confirmação com aviso de irreversibilidade', () => {
    const f = setup();
    expect(text(f)).toContain('Fechar janeiro/2027?');
    expect(text(f)).toContain('imutáveis');
    expect(text(f)).toContain('não poderá ser reaberto');
    expect(ledger.closeMonth).not.toHaveBeenCalled();
  });

  it('fecha o mês ao confirmar', async () => {
    ledger.closeMonth.mockReturnValue(of({}));
    const f = setup();
    one(f, '[data-testid="confirm-close"]').click();
    expect(ledger.closeMonth).toHaveBeenCalledWith('2027-01');
    expect(ref.close).toHaveBeenCalledWith(true);
  });

  it('mantém aberto e mostra o motivo quando o fechamento é rejeitado', async () => {
    ledger.closeMonth.mockReturnValue(
      throwError(
        () => new ApiError('PERIOD_HAS_PENDING_TRANSACTIONS', 'Há lançamentos em aberto.', 409),
      ),
    );
    const f = setup();
    one(f, '[data-testid="confirm-close"]').click();
    f.detectChanges();
    expect(one(f, '[data-testid="rejection"]').textContent).toContain('Há lançamentos em aberto.');
    expect(ref.close).not.toHaveBeenCalled();
  });
});

describe('PayDialog', () => {
  it('mantém o botão desabilitado sem data (e sem método quando é exigido)', () => {
    const f = create(
      PayDialog,
      { title: 'Pagar fatura', confirmLabel: 'Pagar', methods: [{ id: 'm1', name: 'PIX' }] },
      [],
    );
    expect(submitButton(f).disabled).toBe(true);
    form(f).patchValue({ payment_method_id: 'm1' });
    f.detectChanges();
    expect(submitButton(f).disabled).toBe(false);
    form(f).patchValue({ paid_at: '' });
    f.detectChanges();
    expect(submitButton(f).disabled).toBe(true);
  });

  it('devolve a data escolhida', async () => {
    const f = create(PayDialog, { title: 'Pagar', confirmLabel: 'Pagar' }, []);
    form(f).patchValue({ paid_at: '2027-01-08' });
    await submit(f);
    expect(ref.close).toHaveBeenCalledWith({ paid_at: '2027-01-08' });
  });

  it('sugere hoje como data e exige o método quando há opções', async () => {
    const f = create(
      PayDialog,
      { title: 'Pagar fatura', confirmLabel: 'Pagar', methods: [{ id: 'm1', name: 'PIX' }] },
      [],
    );
    expect(form(f).value.paid_at).toBe('2027-01-10');
    await submit(f);
    expect(ref.close).not.toHaveBeenCalled();
    form(f).patchValue({ payment_method_id: 'm1' });
    await submit(f);
    expect(ref.close).toHaveBeenCalledWith({ paid_at: '2027-01-10', payment_method_id: 'm1' });
  });
});
