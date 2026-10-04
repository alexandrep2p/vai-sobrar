import { afterAll, describe, expect, it } from 'vitest';
import { parseLocalDate } from '../../src/shared/dates.js';
import { Api, prisma, setupEnv, type TestEnv } from './helpers.js';

let env: TestEnv;
let api: Api;
let expense: string;
let pix: string;

afterAll(() => prisma.$disconnect());

const setup = async (today: string) => {
  env = await setupEnv(today);
  api = new Api(env);
  expense = await api.category('Despesas', 'EXPENSE');
  pix = await api.systemMethod('PIX');
};
const goto = (date: string) => env.clock.set(parseLocalDate(date));
const code = (res: { body: { error?: { code: string } } }) => res.body.error?.code;

const buy = (
  methodId: string,
  purchaseDate: string,
  amount = 10000,
  extra: Record<string, unknown> = {},
) =>
  api.post('/api/transactions', {
    description: 'Compra',
    amount,
    purchase_date: purchaseDate,
    category_id: expense,
    payment_method_id: methodId,
    ...extra,
  });
const payInvoice = (invoiceId: string, paidAt: string) =>
  api.post(`/api/invoices/${invoiceId}/pay`, { paid_at: paidAt, payment_method_id: pix });
const close = (month: string) => api.post(`/api/financial-periods/${month}/close`);
const statement = async (month: string) =>
  (await api.get(`/api/monthly-statement?month=${month}`)).body;

describe('cenários de integração ponta a ponta (T-46)', () => {
  it('1. compra tardia: fatura paga empurra a compra para a próxima, preservando a data', async () => {
    await setup('2027-10-20');
    const card = await api.card('Nubank', 6, 15);
    const first = await buy(card.methodId, '2027-10-03');
    await payInvoice(first.body.invoice.id, '2027-10-14');
    const late = await buy(card.methodId, '2027-10-05');
    expect(late.body).toMatchObject({
      purchase_date: '2027-10-05',
      financial_month: '2027-11',
      due_date: '2027-11-15',
    });
    const nov = await statement('2027-11');
    expect(nov.items[0]).toMatchObject({ display_date: '2027-10-05', status: 'PENDING' });
    expect((await statement('2027-10')).items).toHaveLength(1); // a fatura paga não foi alterada
  });

  it('2. vencimento no mês seguinte: outubro só fecha depois que a fatura (vence 05/11) é paga, mesmo antes do fechamento dela', async () => {
    await setup('2027-10-20');
    const card = await api.card('Nubank', 25, 5);
    const purchase = await buy(card.methodId, '2027-10-20', 40000);
    expect(purchase.body).toMatchObject({ financial_month: '2027-10', due_date: '2027-11-05' });
    expect(code(await close('2027-10'))).toBe('PERIOD_HAS_PENDING_TRANSACTIONS');

    // PD-32: a fatura pode ser paga ainda aberta (fecha em 25/10), sem esperar o fechamento
    const paid = await payInvoice(purchase.body.invoice.id, '2027-10-20');
    expect(paid.status).toBe(200);
    expect((await close('2027-10')).status).toBe(200);
    // pagamento antes do vencimento (05/11): o mês financeiro continua outubro
    expect((await api.get(`/api/transactions/${purchase.body.id}`)).body.financial_month).toBe(
      '2027-10',
    );
  });

  it('3. estorno tardio de compra em mês fechado: crédito em mês aberto, mês fechado intacto', async () => {
    await setup('2027-04-20');
    const card = await api.card('Nubank', 6, 15);
    const purchase = await buy(card.methodId, '2027-04-05', 30000);
    await payInvoice(purchase.body.invoice.id, '2027-04-14');
    expect((await close('2027-04')).status).toBe(200);
    const aprilBefore = await statement('2027-04');

    goto('2027-06-03');
    const refund = await api.post('/api/refunds', {
      transaction_id: purchase.body.id,
      amount: 30000,
      refund_date: '2027-06-03',
    });
    expect(refund.status).toBe(201);
    expect(refund.body.allocations[0].invoice_reference_month).toBe('2027-06');
    expect(await statement('2027-04')).toEqual(aprilBefore);
    const june = await statement('2027-06');
    expect(june.totals).toEqual({ incomes: 0, expenses: -30000, balance: 30000 });
    expect(june.items[0]).toMatchObject({ item_type: 'REFUND_CREDIT', display_date: '2027-06-03' });
  });

  it('4. saldo credor transportado para uma fatura CLOSED, sem lançamento e sem efeito nos totais', async () => {
    await setup('2027-10-20');
    const card = await api.card('Nubank', 6, 15);
    const y = await buy(card.methodId, '2027-10-05', 20000);
    const x = await buy(card.methodId, '2027-10-08', 10000);
    await api.post('/api/refunds', {
      transaction_id: y.body.id,
      amount: 15000,
      refund_date: '2027-10-20',
    });
    const z = await buy(card.methodId, '2027-11-10', 30000);
    const novTotals = (await statement('2027-11')).totals;
    const decTotals = (await statement('2027-12')).totals;
    const transactionsBefore = await prisma.transaction.count();

    goto('2027-12-10');
    const nov = await api.get(`/api/invoices/${x.body.invoice.id}`);
    expect(nov.body).toMatchObject({
      status: 'CLOSED',
      totals: { amount_due: 0, credit_balance: 5000 },
    });
    const pay = await payInvoice(x.body.invoice.id, '2027-12-01');
    expect(pay.body).toMatchObject({
      credit_balance: 5000,
      credit_transferred_to_invoice_id: z.body.invoice.id,
    });
    const dec = await api.get(`/api/invoices/${z.body.invoice.id}`);
    expect(dec.body).toMatchObject({
      status: 'CLOSED',
      totals: { amount_due: 25000, received_credit: 5000 },
    });
    expect(await prisma.transaction.count()).toBe(transactionsBefore);
    expect((await statement('2027-11')).totals).toEqual(novTotals);
    expect((await statement('2027-12')).totals).toEqual(decTotals);
  });

  it('5. recorrência com cartão desativado e reativado: sem retroativos, status sempre ACTIVE', async () => {
    await setup('2027-01-01');
    const card = await api.card('Nubank', 6, 15);
    const rec = await api.post('/api/recurrences', {
      description: 'Netflix',
      amount: 5000,
      category_id: expense,
      payment_method_id: card.methodId,
      due_day: 10,
      start_date: '2027-01-01',
    });
    goto('2027-02-15');
    await api.get('/api/transactions');
    goto('2027-03-01');
    await api.post(`/api/credit-cards/${card.cardId}/deactivate`);
    goto('2027-04-20');
    await api.get('/api/transactions');
    expect((await api.get(`/api/recurrences/${rec.body.id}`)).body.status).toBe('ACTIVE');
    expect(await statement('2027-05')).toMatchObject({ items: [] });
    goto('2027-05-05');
    await api.post(`/api/credit-cards/${card.cardId}/activate`);
    expect((await statement('2027-06')).items).toHaveLength(1); // 10/05 → fatura de junho (projetada)
    goto('2027-05-10');
    const months = (
      (await api.get('/api/transactions?origin=RECURRENCE')).body.data as {
        occurrence_month: string;
      }[]
    )
      .map((t) => t.occurrence_month)
      .sort();
    expect(months).toEqual(['2027-01', '2027-02', '2027-05']);
  });

  it('6. parcelamento com estorno FIRST_INSTALLMENTS e a primeira parcela já paga', async () => {
    await setup('2027-10-20');
    const card = await api.card('Nubank', 6, 15);
    const plan = await buy(card.methodId, '2027-10-05', 40000, { installment_count: 4 });
    const parcels = plan.body.installment_plan.installments as {
      invoice: { id: string };
      transaction_id: string;
    }[];
    await payInvoice(parcels[0]?.invoice.id as string, '2027-10-14');
    const refund = await api.post('/api/refunds', {
      installment_plan_id: plan.body.installment_plan.id,
      amount: 15000,
      refund_date: '2027-10-20',
      strategy: 'FIRST_INSTALLMENTS',
    });
    expect(refund.status).toBe(201);
    const [a, b] = refund.body.allocations as {
      installment_number: number;
      amount: number;
      invoice_id: string;
      invoice_reference_month: string;
    }[];
    expect(a).toMatchObject({
      installment_number: 1,
      amount: 10000,
      invoice_reference_month: '2027-11',
    });
    expect(b).toMatchObject({
      installment_number: 2,
      amount: 5000,
      invoice_id: parcels[1]?.invoice.id,
    });
    // fatura paga de outubro inalterada; parcelas mantêm o valor original
    const oct = await api.get(`/api/invoices/${parcels[0]?.invoice.id}`);
    expect(oct.body).toMatchObject({ status: 'PAID', totals: { debits: 10000, credits: 0 } });
    const planAfter = await api.get(`/api/installment-plans/${plan.body.installment_plan.id}`);
    expect((planAfter.body.installments as { amount: number }[]).map((i) => i.amount)).toEqual([
      10000, 10000, 10000, 10000,
    ]);
    const nov = await statement('2027-11');
    expect(nov.totals.expenses).toBe(10000 - 15000); // parcela 2/4 menos os dois créditos reconhecidos em novembro
  });

  it('7. fechamento cronológico: mês anterior sem lançamentos não bloqueia; com lançamentos, sim', async () => {
    await setup('2027-08-10');
    const a = await api.post('/api/transactions', {
      description: 'Agosto',
      amount: 1000,
      due_date: '2027-08-12',
      category_id: expense,
      payment_method_id: pix,
    });
    goto('2027-10-05');
    const c = await api.post('/api/transactions', {
      description: 'Outubro',
      amount: 1000,
      due_date: '2027-10-05',
      category_id: expense,
      payment_method_id: pix,
    });
    await api.post(`/api/transactions/${c.body.id}/pay`, { paid_at: '2027-10-05' });
    // agosto (aberto, com lançamento) bloqueia outubro; setembro (sem lançamentos) não
    expect(code(await close('2027-10'))).toBe('PERIOD_PREVIOUS_NOT_CLOSED');
    await api.post(`/api/transactions/${a.body.id}/pay`, { paid_at: '2027-08-12' });
    expect((await close('2027-08')).status).toBe(200);
    expect((await close('2027-10')).status).toBe(200);
    expect((await api.get('/api/financial-periods/2027-09')).body.status).toBe('OPEN');
  });

  it('8. fatura só com créditos bloqueia o fechamento até ser paga com R$ 0,00', async () => {
    await setup('2027-10-06');
    const card = await api.card('Nubank', 6, 15);
    const purchase = await buy(card.methodId, '2027-10-05', 20000);
    goto('2027-10-20');
    await payInvoice(purchase.body.invoice.id, '2027-10-14');
    goto('2027-11-05');
    const refund = await api.post('/api/refunds', {
      transaction_id: purchase.body.id,
      amount: 20000,
      refund_date: '2027-11-05',
    });
    const novInvoice = refund.body.allocations[0].invoice_id as string;
    expect((await close('2027-10')).status).toBe(200);
    goto('2027-11-20');
    expect(code(await close('2027-11'))).toBe('PERIOD_HAS_UNPAID_INVOICES');
    const pay = await payInvoice(novInvoice, '2027-11-19');
    expect(pay.body).toMatchObject({ status: 'PAID', totals: { amount_due: 0 } });
    expect((await close('2027-11')).status).toBe(200);
  });
});
