import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import type {
  CreditCard,
  InvoiceDetail,
  InvoiceSummary,
  PaymentMethod,
} from '../../core/api/models';
import { Clock } from '../../core/clock';
import { CatalogService } from '../../core/data/catalog.service';
import { LedgerService } from '../../core/data/ledger.service';
import { PayDialog } from '../../shared/ui/pay-dialog';
import { AppDialog } from '../../shared/ui/dialog';
import { all, click, dialogProviders, one, text } from '../../../testing/helpers';
import { InvoiceDetailDialog } from './invoice-detail-dialog';
import { InvoicesPage } from './invoices.page';

const card = (over: Partial<CreditCard> = {}): CreditCard => ({
  id: 'k1',
  payment_method_id: 'pm-k1',
  name: 'Nubank',
  active: true,
  best_purchase_day: 6,
  due_day: 15,
  ...over,
});

const summary = (over: Partial<InvoiceSummary> = {}): InvoiceSummary => ({
  id: 'inv1',
  credit_card_id: 'k1',
  reference_month: '2027-01',
  closing_date: '2027-01-06',
  due_date: '2027-01-15',
  status: 'OPEN',
  situation: null,
  persisted: true,
  paid_at: null,
  payment_method_id: null,
  credit_balance: 0,
  projected_total: 0,
  totals: { debits: 64000, credits: 0, received_credit: 0, amount_due: 64000, credit_balance: 0 },
  ...over,
});

const clock = {
  provide: Clock,
  useValue: { today: () => '2027-01-10', currentMonth: () => '2027-01' },
};

describe('InvoicesPage', () => {
  const catalog = { creditCards: vi.fn() };
  const ledger = { invoices: vi.fn() };
  const dialog = { open: vi.fn() };

  beforeEach(() => {
    vi.resetAllMocks();
    ledger.invoices.mockReturnValue(of([]));
    dialog.open.mockReturnValue(of(true));
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        clock,
        { provide: CatalogService, useValue: catalog },
        { provide: LedgerService, useValue: ledger },
        { provide: AppDialog, useValue: dialog },
      ],
    });
  });

  async function render(
    cards: CreditCard[],
    invoices: InvoiceSummary[] = [],
    cardParam: string | null = null,
  ) {
    catalog.creditCards.mockReturnValue(of(cards));
    ledger.invoices.mockReturnValue(of(invoices));
    TestBed.overrideProvider(ActivatedRoute, {
      useValue: {
        snapshot: { queryParamMap: convertToParamMap(cardParam ? { cartao: cardParam } : {}) },
      },
    });
    const fixture = TestBed.createComponent(InvoicesPage);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture;
  }

  it('carrega as faturas do primeiro cartão ativo no período padrão', async () => {
    await render([card({ id: 'old', active: false }), card({ id: 'k1' })]);
    expect(ledger.invoices).toHaveBeenCalledWith('k1', '2027-01', '2027-12');
  });

  it('usa o cartão indicado na URL', async () => {
    await render([card({ id: 'k1' }), card({ id: 'k2', name: 'Inter' })], [], 'k2');
    expect(ledger.invoices).toHaveBeenCalledWith('k2', expect.any(String), expect.any(String));
  });

  it('lista status, atraso, vencimento e valor a pagar', async () => {
    const fixture = await render(
      [card()],
      [
        summary({ reference_month: '2026-11', status: 'PAID' }),
        summary({ id: 'inv2', reference_month: '2026-12', status: 'CLOSED', situation: 'OVERDUE' }),
        summary({ id: 'inv3', reference_month: '2027-01' }),
      ],
    );
    const rows = all(fixture, '[data-testid="invoice-row"]');
    expect(rows).toHaveLength(3);
    expect(rows[0].querySelector('[data-testid="status"]')?.textContent).toContain('Paga');
    expect(rows[1].querySelector('[data-testid="overdue"]')?.textContent).toContain('Atrasada');
    expect(rows[1].querySelector('[data-testid="status"]')?.textContent).toContain('Fechada');
    expect(rows[2].querySelector('[data-testid="status"]')?.textContent).toContain('Aberta');
    expect(rows[2].textContent).toContain('15/01/2027');
    expect(rows[2].querySelector('[data-testid="amount-due"]')?.textContent).toContain('640,00');
  });

  it('ciclos sem fatura aparecem como "Sem lançamentos" e não têm detalhe', async () => {
    const fixture = await render(
      [card()],
      [
        summary({
          id: null,
          persisted: false,
          reference_month: '2027-02',
          totals: { debits: 0, credits: 0, received_credit: 0, amount_due: 0, credit_balance: 0 },
        }),
      ],
    );
    const [row] = all(fixture, '[data-testid="invoice-row"]');
    expect(row.querySelector('[data-testid="no-entries"]')?.textContent).toContain(
      'Sem lançamentos',
    );
    expect(row.querySelector('[data-testid="open"]')).toBeNull();
  });

  it('ciclo sem fatura mas com previsão de recorrência mostra o total previsto e abre o detalhe', async () => {
    const fixture = await render(
      [card()],
      [
        summary({
          id: null,
          persisted: false,
          reference_month: '2027-02',
          projected_total: 4000,
          totals: {
            debits: 4000,
            credits: 0,
            received_credit: 0,
            amount_due: 4000,
            credit_balance: 0,
          },
        }),
      ],
    );
    const [row] = all(fixture, '[data-testid="invoice-row"]');
    expect(row.querySelector('[data-testid="no-entries"]')).toBeNull();
    expect(row.querySelector('[data-testid="amount-due"]')?.textContent).toContain('40,00');
    expect(row.querySelector('[data-testid="projected-chip"]')?.textContent).toContain('Previsto');
    await click(fixture, one(fixture, '[data-testid="open"]'));
    expect(dialog.open).toHaveBeenCalledWith(InvoiceDetailDialog, {
      invoiceId: null,
      month: '2027-02',
      card: card(),
    });
  });

  it('fatura persistida com previsão mostra o total somado e a parte prevista', async () => {
    const fixture = await render(
      [card()],
      [
        summary({
          projected_total: 4000,
          totals: {
            debits: 54000,
            credits: 0,
            received_credit: 0,
            amount_due: 54000,
            credit_balance: 0,
          },
        }),
      ],
    );
    const [row] = all(fixture, '[data-testid="invoice-row"]');
    expect(row.querySelector('[data-testid="amount-due"]')?.textContent).toContain('540,00');
    expect(row.querySelector('[data-testid="projected-total"]')?.textContent).toContain('40,00');
    expect(row.querySelector('[data-testid="status"]')?.textContent).toContain('Aberta');
  });

  it('abre o detalhe da fatura', async () => {
    const fixture = await render([card()], [summary()]);
    await click(fixture, one(fixture, '[data-testid="open"]'));
    expect(dialog.open).toHaveBeenCalledWith(InvoiceDetailDialog, {
      invoiceId: 'inv1',
      month: '2027-01',
      card: card(),
    });
  });

  it('sem cartões mostra o estado vazio', async () => {
    const fixture = await render([]);
    expect(one(fixture, '[data-testid="empty"]').textContent).toContain('Nenhum cartão');
    expect(ledger.invoices).not.toHaveBeenCalled();
  });
});

describe('InvoiceDetailDialog', () => {
  const ledger = { invoice: vi.fn(), invoiceCycle: vi.fn(), payInvoice: vi.fn() };
  const catalog = { paymentMethods: vi.fn() };
  const dialog = { open: vi.fn() };
  const ref = { close: vi.fn() };
  const methods: PaymentMethod[] = [
    { id: 'pm-k1', name: 'Nubank', source: 'USER', kind: 'CREDIT_CARD', active: true },
    { id: 'pix', name: 'PIX', source: 'SYSTEM', kind: 'STANDARD', active: true },
    { id: 'off', name: 'Inativo', source: 'USER', kind: 'STANDARD', active: false },
  ];

  const detail = (over: Partial<InvoiceDetail> = {}): InvoiceDetail => ({
    ...summary({ status: 'CLOSED' }),
    card_name: 'Nubank',
    projected_items: [],
    transactions: [
      {
        id: 't1',
        description: 'Supermercado',
        amount: 64000,
        type: 'EXPENSE',
        financial_month: '2027-01',
        due_date: '2027-01-15',
        paid_at: null,
        status: 'PENDING',
        origin: 'CREDIT_CARD',
        category: { id: 'c', name: 'Mercado', type: 'EXPENSE', active: true },
        payment_method: { id: 'pm-k1', name: 'Nubank', kind: 'CREDIT_CARD', active: true },
        credit_card_id: 'k1',
        purchase_date: '2026-12-20',
        invoice: null,
        recurrence_id: null,
        occurrence_month: null,
        installment: null,
      },
    ],
    credits: [
      {
        allocation_id: 'a1',
        refund_id: 'r1',
        refund_date: '2027-01-03',
        transaction_id: 't0',
        description: 'Tênis',
        amount: 10000,
      },
    ],
    received_credits: [{ invoice_id: 'inv0', reference_month: '2026-12', amount: 500 }],
    ...over,
  });

  function setup(d: InvoiceDetail, data: object = { invoiceId: 'inv1', month: '2027-01' }) {
    vi.resetAllMocks();
    ledger.invoice.mockReturnValue(of(d));
    ledger.invoiceCycle.mockReturnValue(of(d));
    ledger.payInvoice.mockReturnValue(of({ ...d, status: 'PAID' }));
    catalog.paymentMethods.mockReturnValue(of(methods));
    TestBed.configureTestingModule({
      providers: [
        clock,
        ...dialogProviders({ ...data, card: card() }, ref),
        { provide: LedgerService, useValue: ledger },
        { provide: CatalogService, useValue: catalog },
      ],
    });
    // O mock do AppDialog entra no componente (prevalece sobre o do TestBed).
    TestBed.overrideComponent(InvoiceDetailDialog, {
      set: { providers: [{ provide: AppDialog, useValue: dialog }] },
    });
    const fixture = TestBed.createComponent(InvoiceDetailDialog);
    fixture.detectChanges();
    return fixture;
  }

  it('mostra lançamentos, créditos, crédito recebido e totais', () => {
    const f = setup(
      detail({
        totals: {
          debits: 64000,
          credits: 10000,
          received_credit: 500,
          amount_due: 53500,
          credit_balance: 0,
        },
      }),
    );
    expect(all(f, '[data-testid="invoice-transaction"]')).toHaveLength(1);
    expect(all(f, '[data-testid="invoice-credit"]')).toHaveLength(1);
    expect(all(f, '[data-testid="received-credit"]')).toHaveLength(1);
    expect(one(f, '[data-testid="amount-due"]').textContent).toContain('535,00');
    expect(text(f)).toContain('Saldo credor');
    expect(text(f)).toContain('Fechamento: 06/01/2027');
  });

  const projectedItem = {
    recurrence_id: 'r1',
    occurrence_month: '2027-01',
    description: 'Netflix',
    amount: 4000,
    purchase_date: '2027-01-20',
    category: { id: 'c', name: 'Lazer' },
  };

  it('lista as recorrências previstas com o selo "Previsto" e a parte prevista do total', () => {
    const f = setup(
      detail({
        status: 'OPEN',
        projected_items: [projectedItem],
        projected_total: 4000,
        totals: {
          debits: 68000,
          credits: 0,
          received_credit: 0,
          amount_due: 68000,
          credit_balance: 0,
        },
      }),
    );
    const [item] = all(f, '[data-testid="projected-item"]');
    expect(item.textContent).toContain('Netflix');
    expect(item.querySelector('[data-testid="projected-chip"]')?.textContent).toContain('Previsto');
    expect(one(f, '[data-testid="projected-total"]').textContent).toContain('40,00');
    expect(one(f, '[data-testid="amount-due"]').textContent).toContain('680,00');
  });

  it('ciclo sem fatura persistida carrega pelo mês e não oferece pagamento', () => {
    const f = setup(
      detail({
        id: null,
        persisted: false,
        status: 'OPEN',
        transactions: [],
        projected_total: 4000,
        projected_items: [projectedItem],
      }),
      { invoiceId: null, month: '2027-02' },
    );
    expect(ledger.invoiceCycle).toHaveBeenCalledWith('k1', '2027-02');
    expect(ledger.invoice).not.toHaveBeenCalled();
    expect(all(f, '[data-testid="projected-item"]')).toHaveLength(1);
    expect(root(f).querySelector('[data-testid="pay-invoice"]')).toBeNull();
  });

  it('avisa, ao pagar, que as recorrências previstas serão geradas e pagas', async () => {
    const f = setup(detail({ projected_total: 4000, projected_items: [projectedItem] }));
    dialog.open.mockReturnValue(of(undefined));
    await click(f, one(f, '[data-testid="pay-invoice"]'));
    expect(dialog.open.mock.calls[0][1].message).toContain('40,00 de recorrências previstas');
  });

  it('fatura atrasada é sinalizada', () => {
    const f = setup(detail({ situation: 'OVERDUE' }));
    expect(one(f, '[data-testid="overdue"]').textContent).toContain('Atrasada');
  });

  it('oferece "Pagar fatura" enquanto a fatura não está paga (aberta ou fechada)', () => {
    expect(
      root(setup(detail({ status: 'CLOSED' }))).querySelector('[data-testid="pay-invoice"]'),
    ).not.toBeNull();
    TestBed.resetTestingModule();
    expect(
      root(setup(detail({ status: 'OPEN' }))).querySelector('[data-testid="pay-invoice"]'),
    ).not.toBeNull();
    TestBed.resetTestingModule();
    expect(
      root(setup(detail({ status: 'PAID' }))).querySelector('[data-testid="pay-invoice"]'),
    ).toBeNull();
  });

  it('paga com data e método, excluindo o próprio cartão e os métodos inativos', async () => {
    const f = setup(detail());
    dialog.open.mockReturnValue(of({ paid_at: '2027-01-12', payment_method_id: 'pix' }));
    await click(f, one(f, '[data-testid="pay-invoice"]'));
    const [component, config] = dialog.open.mock.calls[0];
    expect(component).toBe(PayDialog);
    expect(config.methods).toEqual([{ id: 'pix', name: 'PIX' }]);
    expect(ledger.payInvoice).toHaveBeenCalledWith('inv1', {
      paid_at: '2027-01-12',
      payment_method_id: 'pix',
    });
    expect(ref.close).toHaveBeenCalledWith(true);
  });

  it('permite pagar fatura com valor a pagar R$ 0,00', async () => {
    const f = setup(
      detail({
        totals: {
          debits: 0,
          credits: 10000,
          received_credit: 0,
          amount_due: 0,
          credit_balance: 10000,
        },
      }),
    );
    dialog.open.mockReturnValue(of({ paid_at: '2027-01-12', payment_method_id: 'pix' }));
    await click(f, one(f, '[data-testid="pay-invoice"]'));
    expect(dialog.open.mock.calls[0][1].message).toContain('0,00');
    expect(ledger.payInvoice).toHaveBeenCalled();
  });

  it('cancelar o diálogo de pagamento não paga', async () => {
    const f = setup(detail());
    dialog.open.mockReturnValue(of(undefined));
    await click(f, one(f, '[data-testid="pay-invoice"]'));
    expect(ledger.payInvoice).not.toHaveBeenCalled();
  });
});

function root(f: { nativeElement: unknown }): HTMLElement {
  return f.nativeElement as HTMLElement;
}
