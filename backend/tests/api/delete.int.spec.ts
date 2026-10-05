import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { parseLocalDate } from '../../src/shared/dates.js';
import { Api, prisma, setupEnv, type TestEnv } from './helpers.js';

// T-57 / PD-38 (provisório): apagar lançamentos e compras parceladas.

let env: TestEnv;
let api: Api;
let expense: string;
let pix: string;
let cardMethod: string;

afterAll(() => prisma.$disconnect());

const setup = async (today: string) => {
  env = await setupEnv(today);
  api = new Api(env);
  expense = await api.category('Despesas', 'EXPENSE');
  pix = await api.systemMethod('PIX');
  ({ methodId: cardMethod } = await api.card('Nubank', 6, 15));
};
const goto = (date: string) => env.clock.set(parseLocalDate(date));

const buy = (purchaseDate: string, extra: Record<string, unknown> = {}) =>
  api.post('/api/transactions', {
    description: 'Compra',
    amount: 30000,
    purchase_date: purchaseDate,
    category_id: expense,
    payment_method_id: cardMethod,
    ...extra,
  });
const pay = (invoiceId: string, paidAt: string) =>
  api.post(`/api/invoices/${invoiceId}/pay`, { paid_at: paidAt, payment_method_id: pix });
const refund = (body: Record<string, unknown>) => api.post('/api/refunds', body);
const closeMonth = (month: string) =>
  prisma.financialPeriod.create({
    data: { referenceMonth: month, status: 'CLOSED', closedAt: new Date() },
  });
const counts = async () => ({
  transactions: await prisma.transaction.count(),
  invoices: await prisma.invoice.count(),
  refunds: await prisma.refund.count(),
  allocations: await prisma.refundAllocation.count(),
  plans: await prisma.installmentPlan.count(),
  installments: await prisma.installment.count(),
});

describe('apagar lançamento (PD-38)', () => {
  beforeEach(() => setup('2027-10-01'));

  it('lançamento manual continua sendo apagado; mês fechado bloqueia', async () => {
    const created = await api.post('/api/transactions', {
      description: 'Luz',
      amount: 10000,
      due_date: '2027-10-10',
      category_id: expense,
      payment_method_id: pix,
    });
    expect(created.status).toBe(201);
    await closeMonth('2027-10');
    const blocked = await api.delete(`/api/transactions/${created.body.id}`);
    expect(blocked.body.error.code).toBe('PERIOD_CLOSED');
    await prisma.financialPeriod.deleteMany();
    expect((await api.delete(`/api/transactions/${created.body.id}`)).status).toBe(204);
    expect((await counts()).transactions).toBe(0);
  });

  it('CA-CAR-13: compra à vista no cartão é apagada e a fatura que ficou vazia deixa de existir', async () => {
    const res = await buy('2027-10-05');
    expect((await counts()).invoices).toBe(1);
    expect((await api.delete(`/api/transactions/${res.body.id}`)).status).toBe(204);
    expect(await counts()).toMatchObject({ transactions: 0, invoices: 0 });
  });

  it('mantém a fatura quando ela ainda tem outros lançamentos', async () => {
    const first = await buy('2027-10-05');
    await buy('2027-10-05', { description: 'Outra' });
    await api.delete(`/api/transactions/${first.body.id}`);
    expect(await counts()).toMatchObject({ transactions: 1, invoices: 1 });
  });

  it('fatura PAID bloqueia e nada muda', async () => {
    const res = await buy('2027-10-05');
    expect((await pay(res.body.invoice.id, '2027-10-01')).status).toBe(200);
    const blocked = await api.delete(`/api/transactions/${res.body.id}`);
    expect(blocked.status).toBe(409);
    expect(blocked.body.error.code).toBe('INVOICE_ALREADY_PAID');
    expect(await counts()).toMatchObject({ transactions: 1, invoices: 1 });
  });

  it('apagar a compra apaga junto os estornos e as alocações', async () => {
    const res = await buy('2027-10-05');
    goto('2027-10-06');
    const refunded = await refund({
      transaction_id: res.body.id,
      amount: 10000,
      refund_date: '2027-10-06',
    });
    expect(refunded.status).toBe(201);
    expect(await counts()).toMatchObject({ refunds: 1, allocations: 1 });

    expect((await api.delete(`/api/transactions/${res.body.id}`)).status).toBe(204);
    expect(await counts()).toMatchObject({
      transactions: 0,
      refunds: 0,
      allocations: 0,
      invoices: 0,
    });
  });

  it('estorno reconhecido em fatura paga bloqueia apagar a compra', async () => {
    goto('2027-10-20');
    const res = await buy('2027-10-05'); // fatura de outubro já fechada
    const refunded = await refund({
      transaction_id: res.body.id,
      amount: 10000,
      refund_date: '2027-10-10',
    });
    expect(refunded.status).toBe(201);
    const credit = await prisma.refundAllocation.findFirstOrThrow();
    expect((await pay(credit.invoiceId, '2027-10-20')).status).toBe(200);

    const blocked = await api.delete(`/api/transactions/${res.body.id}`);
    expect(blocked.body.error.code).toBe('INVOICE_ALREADY_PAID');
    expect(await counts()).toMatchObject({ transactions: 1, refunds: 1, allocations: 1 });
  });
});

describe('apagar ocorrência de recorrência (PD-38)', () => {
  beforeEach(() => setup('2027-09-20'));

  const createRec = (extra: Record<string, unknown> = {}) =>
    api.post('/api/recurrences', {
      description: 'Aluguel',
      amount: 150000,
      category_id: expense,
      payment_method_id: pix,
      due_day: 5,
      start_date: '2027-09-01',
      ...extra,
    });
  const occurrences = async () =>
    (await api.get('/api/transactions?origin=RECURRENCE')).body.data as {
      id: string;
      occurrence_month: string;
    }[];

  it('ocorrência paga é apagada, vira exceção e não é gerada de novo', async () => {
    const rec = await createRec();
    goto('2027-10-05');
    const [tx] = await occurrences();
    expect(tx).toBeTruthy();
    await api.post(`/api/transactions/${tx?.id}/pay`, { paid_at: '2027-10-05' });

    expect((await api.delete(`/api/transactions/${tx?.id}`)).status).toBe(204);
    expect(await occurrences()).toHaveLength(0);
    expect(
      await prisma.recurrenceException.count({
        where: { recurrenceId: rec.body.id, occurrenceMonth: '2027-10' },
      }),
    ).toBe(1);

    // acessos seguintes (e a geração por data) não recriam a ocorrência
    goto('2027-10-06');
    await api.get('/api/transactions');
    expect(await occurrences()).toHaveLength(0);
    // a recorrência segue valendo para o mês seguinte
    goto('2027-11-05');
    await api.get('/api/transactions');
    expect((await occurrences()).map((o) => o.occurrence_month)).toEqual(['2027-11']);
  });

  it('ocorrência de cartão é apagada com fatura aberta e bloqueada com fatura paga', async () => {
    const { methodId, cardId } = await api.card('Inter', 6, 15);
    await createRec({ payment_method_id: methodId, description: 'Netflix', amount: 5000 });
    goto('2027-10-05');
    const [tx] = await occurrences();
    expect(tx).toBeTruthy();
    const full = (await api.get(`/api/transactions/${tx?.id}`)).body;

    await pay(full.invoice.id, '2027-10-05');
    const blocked = await api.delete(`/api/transactions/${tx?.id}`);
    expect(blocked.body.error.code).toBe('INVOICE_ALREADY_PAID');
    expect(cardId).toBeTruthy();
  });

  it('ocorrência de cartão em fatura aberta é apagada', async () => {
    const { methodId } = await api.card('Inter', 6, 15);
    await createRec({ payment_method_id: methodId, description: 'Netflix', amount: 5000 });
    goto('2027-10-05');
    const [tx] = await occurrences();
    expect((await api.delete(`/api/transactions/${tx?.id}`)).status).toBe(204);
    expect(await occurrences()).toHaveLength(0);
    expect((await counts()).invoices).toBe(0);
  });
});

describe('apagar compra parcelada (PD-38)', () => {
  beforeEach(() => setup('2027-10-01'));

  const planOf = async (extra: Record<string, unknown> = {}) => {
    const res = await buy('2027-10-05', { installment_count: 3, amount: 30000, ...extra });
    return res.body.installment_plan as {
      id: string;
      installments: { transaction_id: string; invoice: { id: string } }[];
    };
  };

  it('apaga o plano inteiro, as parcelas e as faturas que ficaram vazias', async () => {
    const plan = await planOf();
    expect(await counts()).toMatchObject({ transactions: 3, invoices: 3, plans: 1 });
    expect((await api.delete(`/api/installment-plans/${plan.id}`)).status).toBe(204);
    expect(await counts()).toMatchObject({
      transactions: 0,
      installments: 0,
      plans: 0,
      invoices: 0,
    });
    expect((await api.get(`/api/installment-plans/${plan.id}`)).status).toBe(404);
  });

  it('mantém faturas que ainda têm outros lançamentos', async () => {
    await buy('2027-10-05', { description: 'À vista' });
    const plan = await planOf();
    await api.delete(`/api/installment-plans/${plan.id}`);
    expect(await counts()).toMatchObject({ transactions: 1, invoices: 1, plans: 0 });
  });

  it('parcela isolada não é apagada', async () => {
    const plan = await planOf();
    const res = await api.delete(`/api/transactions/${plan.installments[0]?.transaction_id}`);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('TRANSACTION_NOT_DELETABLE');
    expect((await counts()).transactions).toBe(3);
  });

  it('apaga junto os estornos do plano', async () => {
    const plan = await planOf();
    goto('2027-10-06');
    const refunded = await refund({
      installment_plan_id: plan.id,
      amount: 5000,
      refund_date: '2027-10-06',
      strategy: 'FIRST_INSTALLMENTS',
    });
    expect(refunded.status).toBe(201);
    expect((await api.delete(`/api/installment-plans/${plan.id}`)).status).toBe(204);
    expect(await counts()).toMatchObject({
      transactions: 0,
      refunds: 0,
      allocations: 0,
      invoices: 0,
    });
  });

  it('bloqueia com parcela em fatura PAID e nada muda', async () => {
    goto('2027-10-20');
    const plan = await planOf();
    expect((await pay(plan.installments[0]?.invoice.id as string, '2027-10-20')).status).toBe(200);
    const blocked = await api.delete(`/api/installment-plans/${plan.id}`);
    expect(blocked.status).toBe(409);
    expect(blocked.body.error.code).toBe('INVOICE_ALREADY_PAID');
    expect(await counts()).toMatchObject({ transactions: 3, plans: 1 });
  });

  it('bloqueia com parcela em mês fechado', async () => {
    const plan = await planOf();
    await closeMonth('2027-12');
    const blocked = await api.delete(`/api/installment-plans/${plan.id}`);
    expect(blocked.body.error.code).toBe('PERIOD_CLOSED');
    expect(await counts()).toMatchObject({ transactions: 3, plans: 1 });
  });

  it('plano inexistente → 404', async () => {
    const res = await api.delete('/api/installment-plans/00000000-0000-4000-8000-000000000000');
    expect(res.status).toBe(404);
  });
});
