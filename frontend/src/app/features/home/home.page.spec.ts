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

    it('exclui após confirmar e não exclui se cancelar', async () => {
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

    it('compra de cartão: editar e estornar, sem pagar nem excluir', async () => {
      const fixture = await render(statement([cardItem()]));
      const buttons = await openMenu(fixture, rows(fixture)[0]);
      expect(buttons.map((b) => b.dataset['testid'])).toEqual(['act-edit', 'act-refund']);
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
