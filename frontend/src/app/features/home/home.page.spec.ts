import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { of } from 'rxjs';
import { Clock } from '../../core/clock';
import { LedgerService } from '../../core/data/ledger.service';
import {
  cardItem,
  installmentItem,
  projectedItem,
  recurrenceItem,
  refundCreditItem,
  statement,
  statementItem,
} from '../../../testing/fixtures';
import { all, click, fail, one, text } from '../../../testing/helpers';
import { CloseMonthDialog } from './close-month-dialog';
import { HomePage } from './home.page';
import { PurchaseDetailDialog } from './purchase-detail-dialog';
import { RefundDialog } from './refund-dialog';
import { TransactionEditDialog } from './transaction-edit-dialog';
import { TransactionFormDialog } from './transaction-form-dialog';

describe('HomePage', () => {
  const ledger = {
    statement: vi.fn(),
    transactionRefunds: vi.fn(),
    planRefunds: vi.fn(),
    payTransaction: vi.fn(),
    payOccurrence: vi.fn(),
    unpayTransaction: vi.fn(),
    deleteTransaction: vi.fn(),
    skipOccurrence: vi.fn(),
    deletePlan: vi.fn(),
  };
  const dialog = { open: vi.fn() };
  const noRefund = {
    original_amount: 1,
    refunded_amount: 0,
    refundable_amount: 1,
    refund_status: null,
  };

  beforeEach(() => {
    vi.resetAllMocks();
    ledger.transactionRefunds.mockReturnValue(of(noRefund));
    ledger.planRefunds.mockReturnValue(of(noRefund));
    for (const method of [
      'payTransaction',
      'payOccurrence',
      'unpayTransaction',
      'deleteTransaction',
      'skipOccurrence',
      'deletePlan',
    ] as const) {
      ledger[method].mockReturnValue(of({}));
    }
    dialog.open.mockReturnValue({ afterClosed: () => of(true) });
    TestBed.configureTestingModule({
      providers: [
        { provide: LedgerService, useValue: ledger },
        { provide: MatDialog, useValue: dialog },
        { provide: Clock, useValue: { today: () => '2027-01-10', currentMonth: () => '2027-01' } },
      ],
    });
  });

  async function render(data = statement([statementItem()])) {
    ledger.statement.mockReturnValue(of(data));
    const fixture = TestBed.createComponent(HomePage);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture;
  }

  const rows = (f: ComponentFixture<unknown>) => all(f, '[data-testid="item"]');
  const testid = (f: ComponentFixture<unknown>, id: string) =>
    one(f, `[data-testid="${id}"]`).textContent?.replace(/\s+/g, ' ').trim();

  /** Abre o menu de ações da linha e devolve os botões do overlay. */
  async function openMenu(f: ComponentFixture<unknown>, row: HTMLElement) {
    await click(f, row.querySelector<HTMLElement>('[data-testid="menu"]')!);
    return Array.from(document.querySelectorAll<HTMLElement>('[data-testid^="act-"]'));
  }

  describe('painéis por cartão e filtros (PD-39)', () => {
    const nbsp = (t?: string | null) => t?.replace(/\s+/g, ' ').trim();
    const mercado = { id: 'cat-m', name: 'Mercado' };
    const lazer = { id: 'cat-l', name: 'Lazer' };
    const inter = { id: 'card2', name: 'Inter' };
    const interMethod = { id: 'pm-inter', name: 'Inter' };

    /** 1 item sem cartão (PIX/Moradia) + 2 no Nubank (Mercado) + 1 no Inter (Lazer). */
    const items = () => [
      statementItem(),
      cardItem({ category: mercado }),
      installmentItem({ category: mercado }),
      cardItem({
        description: 'Cinema',
        amount: 4000,
        signed_amount: -4000,
        transaction_id: 't-inter',
        category: lazer,
        credit_card: inter,
        payment_method: interMethod,
      }),
    ];
    const panels = (f: ComponentFixture<unknown>) => all(f, '[data-testid="card-panel"]');
    const panelNames = (f: ComponentFixture<unknown>) =>
      panels(f).map((p) => nbsp(p.querySelector('[data-testid="panel-title"]')?.textContent));
    const itemsIn = (panel: HTMLElement) =>
      Array.from(panel.querySelectorAll<HTMLElement>('[data-testid="item"]'));
    const isOpen = (panel: HTMLElement) => panel.classList.contains('mat-expanded');
    const setFilter = (
      f: ComponentFixture<unknown>,
      filter: 'categoryFilter' | 'methodFilter',
      ids: string[],
    ) => {
      (f.componentInstance as unknown as Record<string, { set: (v: string[]) => void }>)[
        filter
      ].set(ids);
      f.detectChanges();
    };

    it('itens de cartão ficam em um painel por cartão, recolhidos; os demais em lista', async () => {
      const f = await render(statement(items()));
      expect(panelNames(f)).toEqual(['Nubank', 'Inter']);
      expect(panels(f).some(isOpen)).toBe(false);
      expect(all(f, '[data-testid="other-items"] [data-testid="item"]')).toHaveLength(1);
      expect(itemsIn(panels(f)[0]!)).toHaveLength(2);
      expect(itemsIn(panels(f)[1]!)).toHaveLength(1);
    });

    it('o cabeçalho mostra a quantidade de lançamentos e o total do cartão', async () => {
      const f = await render(statement(items()));
      const [nubank, cardInter] = panels(f);
      const summary = (p: HTMLElement) =>
        nbsp(p.querySelector('[data-testid="panel-summary"]')?.textContent);
      expect(summary(nubank!)).toBe('2 lançamentos · − R$ 699,00');
      expect(summary(cardInter!)).toBe('1 lançamento · − R$ 40,00');
    });

    it('sem itens de cartão não há painéis', async () => {
      const f = await render(statement([statementItem()]));
      expect(panels(f)).toHaveLength(0);
      expect(all(f, '[data-testid="other-items"] [data-testid="item"]')).toHaveLength(1);
    });

    it('as opções dos filtros são as categorias e os métodos do mês', async () => {
      const f = await render(statement(items()));
      const c = f.componentInstance as unknown as {
        categoryOptions: () => { name: string }[];
        methodOptions: () => { name: string }[];
      };
      expect(c.categoryOptions().map((o) => o.name)).toEqual(['Lazer', 'Mercado', 'Moradia']);
      expect(c.methodOptions().map((o) => o.name)).toEqual(['Inter', 'Nubank', 'PIX']);
    });

    it('filtra por categoria: painéis abrem, sem itens somem, totais do mês não mudam', async () => {
      const f = await render(statement(items()));
      const before = [testid(f, 'incomes'), testid(f, 'expenses'), testid(f, 'balance')];
      setFilter(f, 'categoryFilter', ['cat-m']);
      expect(panelNames(f)).toEqual(['Nubank']);
      expect(isOpen(panels(f)[0]!)).toBe(true);
      expect(all(f, '[data-testid="other-items"]')).toHaveLength(0);
      expect(rows(f)).toHaveLength(2);
      expect(nbsp(testid(f, 'filtered-summary'))).toBe('Filtrados: 2 itens · − R$ 699,00');
      expect([testid(f, 'incomes'), testid(f, 'expenses'), testid(f, 'balance')]).toEqual(before);
    });

    it('vários valores no mesmo filtro valem como "ou"; entre filtros vale "e"', async () => {
      const f = await render(statement(items()));
      setFilter(f, 'categoryFilter', ['cat-m', 'cat-l']);
      expect(panelNames(f)).toEqual(['Nubank', 'Inter']);
      expect(rows(f)).toHaveLength(3);

      setFilter(f, 'methodFilter', ['pm-inter']);
      expect(panelNames(f)).toEqual(['Inter']);
      expect(rows(f)).toHaveLength(1);
      expect(nbsp(testid(f, 'filtered-summary'))).toBe('Filtrados: 1 item · − R$ 40,00');
    });

    it('filtro por método de pagamento mostra só os itens do método', async () => {
      const f = await render(statement(items()));
      setFilter(f, 'methodFilter', ['pm1']);
      expect(panels(f)).toHaveLength(0);
      expect(rows(f)).toHaveLength(1);
      expect(rows(f)[0]!.textContent).toContain('Aluguel');
    });

    it('"Limpar filtros" restaura a lista e recolhe os painéis', async () => {
      const f = await render(statement(items()));
      setFilter(f, 'categoryFilter', ['cat-m']);
      await click(f, one(f, '[data-testid="clear-filters"]'));
      expect(rows(f)).toHaveLength(4);
      expect(all(f, '[data-testid="filtered-summary"]')).toHaveLength(0);
      expect(all(f, '[data-testid="clear-filters"]')).toHaveLength(0);
      expect(panels(f).some(isOpen)).toBe(false);
    });

    it('filtro sem resultado mostra a mensagem própria', async () => {
      const f = await render(statement(items()));
      setFilter(f, 'categoryFilter', ['cat-l']);
      setFilter(f, 'methodFilter', ['pm1']);
      expect(testid(f, 'empty-filtered')).toBe('Nenhum item corresponde aos filtros.');
      expect(rows(f)).toHaveLength(0);
    });

    it('seleciona pelo componente de seleção (overlay)', async () => {
      const f = await render(statement(items()));
      await click(f, one(f, '[data-testid="filter-method"] .mat-mdc-select-trigger'));
      const options = Array.from(document.querySelectorAll<HTMLElement>('mat-option'));
      const inter = options.find((o) => nbsp(o.textContent) === 'Inter')!;
      await click(f, inter);
      expect(panelNames(f)).toEqual(['Inter']);
    });

    it('ao trocar de mês, descarta seleções que não existem no novo mês', async () => {
      const f = await render(statement(items()));
      setFilter(f, 'categoryFilter', ['cat-l']);
      ledger.statement.mockReturnValue(of(statement([statementItem()])));
      await click(f, one(f, '[data-testid="next"]'));
      expect(all(f, '[data-testid="clear-filters"]')).toHaveLength(0);
      expect(rows(f)).toHaveLength(1);
    });

    it('as ações do item funcionam dentro do painel', async () => {
      const f = await render(statement(items()));
      dialog.open.mockReturnValue({ afterClosed: () => of(true) });
      const buttons = await openMenu(f, itemsIn(panels(f)[0]!)[0]!);
      await click(
        f,
        buttons.find((b) => b.dataset['testid'] === 'act-delete')!,
      );
      expect(ledger.deleteTransaction).toHaveBeenCalledWith('t-card');
    });
  });

  describe('resumo e mês (CA-HOME-01)', () => {
    it('carrega o mês corrente e mostra o resumo', async () => {
      const fixture = await render();
      expect(ledger.statement).toHaveBeenCalledWith('2027-01');
      expect(testid(fixture, 'month-label')).toBe('janeiro de 2027');
      expect(testid(fixture, 'incomes')).toContain('8.800,00');
      expect(testid(fixture, 'expenses')).toContain('2.759,00');
      expect(testid(fixture, 'balance')).toContain('6.041,00');
      expect(testid(fixture, 'period-status')).toBe('Aberto');
    });

    it('navega para o mês seguinte, o anterior e volta ao atual', async () => {
      const fixture = await render();
      await click(fixture, one(fixture, '[data-testid="next"]'));
      expect(ledger.statement).toHaveBeenLastCalledWith('2027-02');
      expect(testid(fixture, 'month-label')).toBe('fevereiro de 2027');
      await click(fixture, one(fixture, '[data-testid="prev"]'));
      await click(fixture, one(fixture, '[data-testid="prev"]'));
      expect(ledger.statement).toHaveBeenLastCalledWith('2026-12');
      await click(fixture, one(fixture, '[data-testid="today"]'));
      expect(ledger.statement).toHaveBeenLastCalledWith('2027-01');
    });

    it('troca o ano ao navegar de janeiro para o mês anterior', async () => {
      const fixture = await render();
      await click(fixture, one(fixture, '[data-testid="prev"]'));
      expect(testid(fixture, 'month-label')).toBe('dezembro de 2026');
    });

    it('mostra erro com nova tentativa', async () => {
      ledger.statement.mockReturnValueOnce(fail());
      const fixture = TestBed.createComponent(HomePage);
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();
      expect(text(fixture)).toContain('Não foi possível carregar');
      ledger.statement.mockReturnValue(of(statement([])));
      await click(fixture, one(fixture, '[role="alert"] button'));
      expect(testid(fixture, 'empty')).toContain('Nenhum item');
    });
  });

  describe('itens do extrato (CA-HOME-06, CA-HOME-12)', () => {
    it('mostra data, valor com sinal, status e natureza', async () => {
      const fixture = await render(
        statement([
          statementItem({
            description: 'Salário',
            nature: 'INCOME',
            amount: 850000,
            signed_amount: 850000,
            status: 'PAID',
          }),
          statementItem({ description: 'Aluguel' }),
        ]),
      );
      const [salary, rent] = rows(fixture);
      expect(salary.textContent).toContain('05/01');
      expect(salary.querySelector('[data-testid="amount"]')?.textContent).toContain('+ R$');
      expect(salary.querySelector('[data-testid="status"]')?.textContent).toContain('Pago');
      expect(rent.querySelector('[data-testid="amount"]')?.textContent).toContain('− R$');
      expect(rent.querySelector('[data-testid="status"]')?.textContent).toContain('Em aberto');
    });

    it('compra de cartão mostra a data da compra e o cartão', async () => {
      const fixture = await render(statement([cardItem({ description: 'Supermercado' })]));
      const [row] = rows(fixture);
      expect(row.textContent).toContain('20/12');
      expect(row.textContent).toContain('Nubank');
    });

    it('parcela mostra n/N e link para a compra original, sem linha do valor total', async () => {
      const fixture = await render(statement([installmentItem()]));
      expect(rows(fixture)).toHaveLength(1);
      expect(testid(fixture, 'installment')).toContain('2/10');
      expect(one(fixture, '[data-testid="amount"]').textContent).toContain('59,00');
      await click(fixture, one(fixture, '[data-testid="purchase-link"]'));
      expect(dialog.open).toHaveBeenCalledWith(
        PurchaseDetailDialog,
        expect.objectContaining({ data: { planId: 'plan1' } }),
      );
    });

    it('crédito de estorno: sem status de pagamento, com link para a compra original', async () => {
      const fixture = await render(statement([refundCreditItem()]));
      const [row] = rows(fixture);
      expect(row.querySelector('[data-testid="status"]')?.textContent).toContain('Crédito');
      expect(
        row.querySelector('[data-testid="amount"]')?.textContent?.replace(/ /g, ' '),
      ).toContain('+ R$ 100,00');
      expect(row.querySelector('[data-testid="menu"]')).toBeNull();
      await click(fixture, one(fixture, '[data-testid="purchase-link"]'));
      expect(dialog.open).toHaveBeenCalledWith(
        PurchaseDetailDialog,
        expect.objectContaining({ data: { transactionId: 't-orig' } }),
      );
    });

    it('ocorrência projetada aparece como prevista e em aberto', async () => {
      const fixture = await render(statement([projectedItem({ description: 'Netflix' })]));
      const [row] = rows(fixture);
      expect(row.classList).toContain('projected');
      expect(row.textContent).toContain('recorrência');
      expect(row.textContent).toContain('prevista');
      expect(row.querySelector('[data-testid="status"]')?.textContent).toContain('Em aberto');
    });

    it('ocorrência gerada é identificada como recorrência', async () => {
      const fixture = await render(statement([recurrenceItem()]));
      expect(rows(fixture)[0].textContent).toContain('recorrência');
      expect(rows(fixture)[0].textContent).not.toContain('prevista');
    });

    it('item de cartão indica liquidação pela fatura', async () => {
      const fixture = await render(statement([cardItem()]));
      expect(testid(fixture, 'settled-by-invoice')).toContain('fatura');
    });

    it('mostra a situação de estorno da compra', async () => {
      ledger.transactionRefunds.mockReturnValue(
        of({ ...noRefund, refund_status: 'PARTIALLY_REFUNDED' }),
      );
      ledger.planRefunds.mockReturnValue(of({ ...noRefund, refund_status: 'FULLY_REFUNDED' }));
      const fixture = await render(statement([cardItem(), installmentItem()]));
      fixture.detectChanges();
      const labels = all(fixture, '[data-testid="refund-label"]').map((e) => e.textContent?.trim());
      expect(labels).toEqual(['Parcialmente estornada', 'Estornada']);
    });
  });

  describe('mês fechado (CA-HOME-11)', () => {
    const closed = () =>
      statement([statementItem(), cardItem(), recurrenceItem()], {
        month: { reference_month: '2027-01', status: 'CLOSED', closed_at: '2027-02-01T00:00:00Z' },
      });

    it('é identificado como fechado e não oferece nenhuma alteração', async () => {
      const fixture = await render(closed());
      expect(testid(fixture, 'period-status')).toBe('Fechado');
      expect(root(fixture).querySelector('[data-testid="new-transaction"]')).toBeNull();
      expect(root(fixture).querySelector('[data-testid="close-month"]')).toBeNull();
      expect(all(fixture, '[data-testid="menu"]')).toHaveLength(0);
      expect(root(fixture).querySelector('[data-testid="settled-by-invoice"]')).toBeNull();
    });
  });

  describe('ações do extrato', () => {
    it('abre o formulário de lançamento e recarrega', async () => {
      const fixture = await render();
      await click(fixture, one(fixture, '[data-testid="new-transaction"]'));
      expect(dialog.open).toHaveBeenCalledWith(TransactionFormDialog, expect.anything());
      expect(ledger.statement).toHaveBeenCalledTimes(2);
    });

    it('abre a confirmação de fechamento e recarrega', async () => {
      const fixture = await render();
      await click(fixture, one(fixture, '[data-testid="close-month"]'));
      expect(dialog.open).toHaveBeenCalledWith(
        CloseMonthDialog,
        expect.objectContaining({ data: '2027-01' }),
      );
      expect(ledger.statement).toHaveBeenCalledTimes(2);
    });

    it('lançamento manual: editar, pagar e excluir no menu', async () => {
      const fixture = await render();
      const buttons = await openMenu(fixture, rows(fixture)[0]);
      expect(buttons.map((b) => b.dataset['testid'])).toEqual([
        'act-edit',
        'act-pay',
        'act-delete',
      ]);
    });

    it('paga o lançamento manual com a data escolhida', async () => {
      dialog.open.mockReturnValue({ afterClosed: () => of({ paid_at: '2027-01-08' }) });
      const fixture = await render();
      const [, pay] = await openMenu(fixture, rows(fixture)[0]);
      await click(fixture, pay);
      expect(ledger.payTransaction).toHaveBeenCalledWith('t1', '2027-01-08');
    });

    it('paga a ocorrência de recorrência pelo endpoint da ocorrência', async () => {
      dialog.open.mockReturnValue({ afterClosed: () => of({ paid_at: '2027-01-08' }) });
      const fixture = await render(statement([projectedItem()]));
      const buttons = await openMenu(fixture, rows(fixture)[0]);
      await click(
        fixture,
        buttons.find((b) => b.dataset['testid'] === 'act-pay')!,
      );
      expect(ledger.payOccurrence).toHaveBeenCalledWith('rec1', '2027-01', '2027-01-08');
    });

    it('desfaz o pagamento de lançamento pago', async () => {
      const fixture = await render(statement([statementItem({ status: 'PAID' })]));
      const buttons = await openMenu(fixture, rows(fixture)[0]);
      await click(
        fixture,
        buttons.find((b) => b.dataset['testid'] === 'act-unpay')!,
      );
      expect(ledger.unpayTransaction).toHaveBeenCalledWith('t1');
    });

    it('apaga após confirmar e não apaga se cancelar', async () => {
      const fixture = await render();
      dialog.open.mockReturnValue({ afterClosed: () => of(false) });
      let buttons = await openMenu(fixture, rows(fixture)[0]);
      await click(
        fixture,
        buttons.find((b) => b.dataset['testid'] === 'act-delete')!,
      );
      expect(ledger.deleteTransaction).not.toHaveBeenCalled();

      dialog.open.mockReturnValue({ afterClosed: () => of(true) });
      buttons = await openMenu(fixture, rows(fixture)[0]);
      await click(
        fixture,
        buttons.find((b) => b.dataset['testid'] === 'act-delete')!,
      );
      expect(ledger.deleteTransaction).toHaveBeenCalledWith('t1');
    });

    it('pula a ocorrência após confirmar', async () => {
      const fixture = await render(statement([projectedItem()]));
      const buttons = await openMenu(fixture, rows(fixture)[0]);
      await click(
        fixture,
        buttons.find((b) => b.dataset['testid'] === 'act-skip')!,
      );
      expect(ledger.skipOccurrence).toHaveBeenCalledWith('rec1', '2027-01');
    });

    it('compra de cartão: editar, estornar e apagar, sem pagar', async () => {
      const fixture = await render(statement([cardItem()]));
      const buttons = await openMenu(fixture, rows(fixture)[0]);
      expect(buttons.map((b) => b.dataset['testid'])).toEqual([
        'act-edit',
        'act-refund',
        'act-delete',
      ]);
    });

    it('apaga a compra de cartão avisando que os estornos vão junto', async () => {
      const fixture = await render(statement([cardItem()]));
      dialog.open.mockReturnValue({ afterClosed: () => of(true) });
      const buttons = await openMenu(fixture, rows(fixture)[0]);
      await click(
        fixture,
        buttons.find((b) => b.dataset['testid'] === 'act-delete')!,
      );
      const [, config] = dialog.open.mock.calls.at(-1)!;
      expect(config.data.title).toBe('Apagar lançamento?');
      expect(config.data.message).toContain('estornos');
      expect(ledger.deleteTransaction).toHaveBeenCalledWith('t-card');
    });

    it('apagar parcela apaga a compra parcelada inteira pelo plano', async () => {
      const fixture = await render(statement([installmentItem()]));
      dialog.open.mockReturnValue({ afterClosed: () => of(true) });
      const buttons = await openMenu(fixture, rows(fixture)[0]);
      await click(
        fixture,
        buttons.find((b) => b.dataset['testid'] === 'act-delete')!,
      );
      const [, config] = dialog.open.mock.calls.at(-1)!;
      expect(config.data.title).toBe('Apagar compra parcelada?');
      expect(config.data.message).toContain('10 parcelas');
      expect(ledger.deletePlan).toHaveBeenCalledWith('plan1');
      expect(ledger.deleteTransaction).not.toHaveBeenCalled();
    });

    it('estorno de compra à vista usa o lançamento', async () => {
      const fixture = await render(statement([cardItem()]));
      const buttons = await openMenu(fixture, rows(fixture)[0]);
      await click(
        fixture,
        buttons.find((b) => b.dataset['testid'] === 'act-refund')!,
      );
      expect(dialog.open).toHaveBeenLastCalledWith(
        RefundDialog,
        expect.objectContaining({ data: { description: 'Supermercado', transactionId: 't-card' } }),
      );
    });

    it('estorno de compra parcelada usa o plano', async () => {
      const fixture = await render(statement([installmentItem()]));
      const buttons = await openMenu(fixture, rows(fixture)[0]);
      await click(
        fixture,
        buttons.find((b) => b.dataset['testid'] === 'act-refund')!,
      );
      expect(dialog.open).toHaveBeenLastCalledWith(
        RefundDialog,
        expect.objectContaining({
          data: { description: 'Mercado Livre — Coxim do motor', planId: 'plan1' },
        }),
      );
    });

    it('editar abre o diálogo de edição com o item', async () => {
      const fixture = await render(statement([statementItem()]));
      const buttons = await openMenu(fixture, rows(fixture)[0]);
      await click(fixture, buttons[0]);
      expect(dialog.open).toHaveBeenCalledWith(
        TransactionEditDialog,
        expect.objectContaining({ data: statementItem() }),
      );
    });
  });
});

function root(fixture: ComponentFixture<unknown>): HTMLElement {
  return fixture.nativeElement as HTMLElement;
}
