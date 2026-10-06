import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import type { InstallmentPlan } from '../../core/api/models';
import { LedgerService } from '../../core/data/ledger.service';
import { AppDialog } from '../../shared/ui/dialog';
import {
  answerSummary,
  click,
  dialogProviders,
  one,
  submitButton,
  summaryRow,
  text,
} from '../../../testing/helpers';
import { PlanEditDialog } from './plan-edit-dialog';
import { PurchaseDetailDialog } from './purchase-detail-dialog';

const plan = (over: Partial<InstallmentPlan> = {}): InstallmentPlan => ({
  id: 'plan1',
  credit_card_id: 'k1',
  description: 'Coxim',
  category: { id: 'c1', name: 'Carro', type: 'EXPENSE' },
  total_amount: 60000,
  installment_count: 3,
  purchase_date: '2027-10-05',
  installments: [1, 2, 3].map((number) => ({
    number,
    transaction_id: `t${number}`,
    amount: 20000,
    status: 'PENDING' as const,
    financial_month: `2027-${9 + number}`,
    due_date: `2027-${9 + number}-15`,
    invoice: { id: `inv${number}`, reference_month: `2027-${9 + number}`, status: 'OPEN' as const },
  })),
  ...over,
});

const type = async (f: ComponentFixture<unknown>, selector: string, value: string) => {
  const input = one<HTMLInputElement>(f, selector);
  input.value = value;
  input.dispatchEvent(new Event('input'));
  f.detectChanges();
  await f.whenStable();
};

describe('PlanEditDialog (T-56)', () => {
  const ledger = { updatePlan: vi.fn() };
  const ref = { close: vi.fn() };

  function setup(data = plan()) {
    vi.resetAllMocks();
    ledger.updatePlan.mockReturnValue(of({}));
    TestBed.configureTestingModule({
      providers: [...dialogProviders(data, ref), { provide: LedgerService, useValue: ledger }],
    });
    const fixture = TestBed.createComponent(PlanEditDialog);
    fixture.detectChanges();
    return fixture;
  }

  const submit = async (f: ComponentFixture<unknown>) => {
    one<HTMLFormElement>(f, 'form').dispatchEvent(new Event('submit'));
    f.detectChanges();
    await f.whenStable();
  };

  it('abre com os dados atuais da compra', () => {
    const f = setup();
    expect(one<HTMLInputElement>(f, '[data-testid="amount"]').value).toBe('600,00');
    expect(one<HTMLInputElement>(f, '[data-testid="count"]').value).toBe('3');
    expect(one<HTMLInputElement>(f, '[data-testid="date"]').value).toBe('2027-10-05');
    expect(submitButton(f).disabled).toBe(false);
  });

  it('desabilita o botão com quantidade ou valor inválidos', async () => {
    const f = setup();
    await type(f, '[data-testid="count"]', '1');
    expect(submitButton(f).disabled).toBe(true);
    await type(f, '[data-testid="count"]', '121');
    expect(submitButton(f).disabled).toBe(true);
    await type(f, '[data-testid="count"]', '6');
    expect(submitButton(f).disabled).toBe(false);
    await type(f, '[data-testid="amount"]', '');
    expect(submitButton(f).disabled).toBe(true);
  });

  it('PD-36: R$ 600 em 3x vira R$ 660 em 6x, com resumo e só os campos alterados', async () => {
    const f = setup();
    await type(f, '[data-testid="amount"]', '66000');
    await type(f, '[data-testid="count"]', '6');
    await submit(f);
    const nbsp = (s?: string) => s?.replace(/\s/g, ' ');
    expect(nbsp(summaryRow('Valor total'))).toBe('R$ 600,00 → R$ 660,00');
    expect(nbsp(summaryRow('Parcelas'))).toBe('3x de R$ 200,00 → 6x de R$ 110,00');
    expect(summaryRow('Data da compra')).toBe('05/10/2027 → 05/10/2027');
    expect(ledger.updatePlan).not.toHaveBeenCalled();

    await answerSummary(f, true);
    expect(ledger.updatePlan).toHaveBeenCalledWith('plan1', {
      total_amount: 66000,
      installment_count: 6,
    });
    expect(ref.close).toHaveBeenCalledWith(true);
  });

  it('envia a nova data da compra', async () => {
    const f = setup();
    await type(f, '[data-testid="date"]', '2027-10-07');
    await submit(f);
    await answerSummary(f, true);
    expect(ledger.updatePlan).toHaveBeenCalledWith('plan1', { purchase_date: '2027-10-07' });
  });

  it('Voltar no resumo não grava', async () => {
    const f = setup();
    await type(f, '[data-testid="count"]', '4');
    await submit(f);
    await answerSummary(f, false);
    expect(ledger.updatePlan).not.toHaveBeenCalled();
    expect(ref.close).not.toHaveBeenCalled();
  });

  it('sem alterações fecha sem chamar a API nem abrir o resumo', async () => {
    const f = setup();
    await submit(f);
    expect(ledger.updatePlan).not.toHaveBeenCalled();
    expect(ref.close).toHaveBeenCalledWith(false);
    expect(summaryRow('Valor total')).toBeUndefined();
  });
});

describe('PurchaseDetailDialog: editar compra (T-56)', () => {
  const ledger = { getPlan: vi.fn(), getTransaction: vi.fn() };
  const dialog = { open: vi.fn() };
  const ref = { close: vi.fn() };

  function setup(p: InstallmentPlan) {
    vi.resetAllMocks();
    ledger.getPlan.mockReturnValue(of(p));
    TestBed.configureTestingModule({
      providers: [
        ...dialogProviders({ planId: p.id }, ref),
        { provide: LedgerService, useValue: ledger },
      ],
    });
    // O mock do AppDialog entra no componente (prevalece sobre o do TestBed).
    TestBed.overrideComponent(PurchaseDetailDialog, {
      set: { providers: [{ provide: AppDialog, useValue: dialog }] },
    });
    const fixture = TestBed.createComponent(PurchaseDetailDialog);
    fixture.detectChanges();
    return fixture;
  }

  it('oferece "Editar compra" e abre o formulário do plano', async () => {
    const p = plan();
    const f = setup(p);
    const button = one<HTMLButtonElement>(f, '[data-testid="edit-plan"]');
    expect(button.disabled).toBe(false);
    dialog.open.mockReturnValue(of(true));
    await click(f, button);
    expect(dialog.open).toHaveBeenCalledWith(PlanEditDialog, p);
    expect(ref.close).toHaveBeenCalledWith(true);
  });

  it('não fecha o detalhe se a edição foi cancelada', async () => {
    const f = setup(plan());
    dialog.open.mockReturnValue(of(undefined));
    await click(f, one(f, '[data-testid="edit-plan"]'));
    expect(ref.close).not.toHaveBeenCalled();
  });

  it('com parcela em fatura paga, desabilita a edição e orienta usar o estorno', () => {
    const paid = plan();
    paid.installments[0]!.invoice = { id: 'inv1', reference_month: '2027-10', status: 'PAID' };
    const f = setup(paid);
    expect(one<HTMLButtonElement>(f, '[data-testid="edit-plan"]').disabled).toBe(true);
    expect(text(f)).toContain('use o estorno');
  });

  it('compra à vista (sem plano) não oferece edição', () => {
    vi.resetAllMocks();
    ledger.getTransaction.mockReturnValue(
      of({
        id: 't1',
        description: 'Mercado',
        amount: 5000,
        category: { name: 'Mercado' },
        payment_method: { name: 'Nubank' },
        purchase_date: '2027-10-05',
        invoice: null,
        installment: null,
      }),
    );
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        ...dialogProviders({ transactionId: 't1' }, ref),
        { provide: LedgerService, useValue: ledger },
      ],
    });
    const f = TestBed.createComponent(PurchaseDetailDialog);
    f.detectChanges();
    expect(f.nativeElement.querySelector('[data-testid="edit-plan"]')).toBeNull();
  });
});
