import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { parseLocalDate } from '../../src/shared/dates.js';
import { refreshAllUsers } from '../../src/shared/refresh.js';
import { Api, prisma, setupEnv, type TestEnv, type TestUser } from './helpers.js';

// Isolamento entre usuários (PD-41, auth.md §7, CA-AUTH-09/10).

let env: TestEnv;
let a: Api;
let b: Api;
let userB: TestUser;

afterAll(() => prisma.$disconnect());

const goto = (date: string) => env.clock.set(parseLocalDate(date));

const setup = async (today = '2027-10-20') => {
  env = await setupEnv(today);
  a = new Api(env);
  userB = await env.addUser('bruno');
  b = new Api(env, userB);
};

/** Dados do usuário A: categoria, cartão, lançamentos, parcelamento, recorrência e estorno. */
const seedA = async () => {
  const category = await a.category('Mercado');
  const pix = await a.systemMethod('PIX');
  const { cardId, methodId: cardMethod } = await a.card('Nubank');
  const manual = await a.post('/api/transactions', {
    description: 'Feira',
    amount: 5000,
    due_date: '2027-10-25',
    category_id: category,
    payment_method_id: pix,
  });
  const purchase = await a.post('/api/transactions', {
    description: 'Mercado',
    amount: 20000,
    purchase_date: '2027-10-10',
    category_id: category,
    payment_method_id: cardMethod,
  });
  const installment = await a.post('/api/transactions', {
    description: 'TV',
    amount: 90000,
    purchase_date: '2027-10-10',
    category_id: category,
    payment_method_id: cardMethod,
    installment_count: 3,
  });
  const recurrence = await a.post('/api/recurrences', {
    description: 'Academia',
    amount: 10000,
    category_id: category,
    payment_method_id: pix,
    due_day: 28,
    start_date: '2027-10-01',
  });
  const refund = await a.post('/api/refunds', {
    transaction_id: purchase.body.id,
    amount: 1000,
    refund_date: '2027-10-15',
  });
  for (const res of [manual, purchase, installment, recurrence, refund]) {
    expect(res.status).toBe(201);
  }
  return {
    category,
    pix,
    cardId,
    cardMethod,
    manualId: manual.body.id as string,
    purchaseId: purchase.body.id as string,
    invoiceId: purchase.body.invoice.id as string,
    planId: installment.body.installment_plan.id as string,
    recurrenceId: recurrence.body.id as string,
    refundId: refund.body.id as string,
  };
};

describe('isolamento entre usuários (CA-AUTH-09)', () => {
  beforeEach(() => setup());

  it('B não vê nenhum dado de A nas listas, no extrato nem nas faturas', async () => {
    const ids = await seedA();

    expect((await b.get('/api/categories')).body.data).toEqual([]);
    expect((await b.get('/api/credit-cards')).body.data).toEqual([]);
    expect((await b.get('/api/recurrences')).body.data).toEqual([]);
    expect((await b.get('/api/transactions?month=2027-10')).body.data).toEqual([]);
    expect((await b.get('/api/transactions')).body.data).toEqual([]);

    const statement = await b.get('/api/monthly-statement?month=2027-10');
    expect(statement.status).toBe(200);
    expect(statement.body.items).toEqual([]);

    const methods = (await b.get('/api/payment-methods')).body.data as { id: string }[];
    expect(methods).toHaveLength(3);
    expect(methods.map((m) => m.id)).not.toContain(ids.pix);

    // A continua vendo os próprios dados
    expect((await a.get('/api/categories')).body.data).toHaveLength(1);
    expect((await a.get('/api/transactions?month=2027-10')).body.data.length).toBeGreaterThan(0);
  });

  it('consultar dado de A por id → não encontrado', async () => {
    const ids = await seedA();
    const cases: [string, string][] = [
      [`/api/credit-cards/${ids.cardId}`, 'CARD_NOT_FOUND'],
      [`/api/credit-cards/${ids.cardId}/invoices`, 'CARD_NOT_FOUND'],
      [`/api/credit-cards/${ids.cardId}/invoices/2027-10`, 'CARD_NOT_FOUND'],
      [`/api/transactions/${ids.manualId}`, 'TRANSACTION_NOT_FOUND'],
      [`/api/transactions/${ids.purchaseId}/refunds`, 'TRANSACTION_NOT_FOUND'],
      [`/api/installment-plans/${ids.planId}`, 'INSTALLMENT_PLAN_NOT_FOUND'],
      [`/api/installment-plans/${ids.planId}/refunds`, 'INSTALLMENT_PLAN_NOT_FOUND'],
      [`/api/invoices/${ids.invoiceId}`, 'INVOICE_NOT_FOUND'],
      [`/api/refunds/${ids.refundId}`, 'REFUND_NOT_FOUND'],
      [`/api/recurrences/${ids.recurrenceId}`, 'RECURRENCE_NOT_FOUND'],
    ];
    for (const [path, code] of cases) {
      const res = await b.get(path);
      expect(res.status, path).toBe(404);
      expect(res.body.error.code, path).toBe(code);
    }
  });

  it('alterar, pagar ou apagar dado de A → não encontrado, sem efeito', async () => {
    const ids = await seedA();
    const before = {
      categories: await prisma.category.findMany({ orderBy: { id: 'asc' } }),
      transactions: await prisma.transaction.findMany({ orderBy: { id: 'asc' } }),
      recurrences: await prisma.recurrence.findMany(),
      invoices: await prisma.invoice.findMany({ orderBy: { id: 'asc' } }),
    };

    const attempts = [
      b.put(`/api/categories/${ids.category}`, { name: 'Invadido' }),
      b.post(`/api/categories/${ids.category}/deactivate`),
      b.put(`/api/payment-methods/${ids.pix}`, { name: 'X' }),
      b.post(`/api/payment-methods/${ids.pix}/deactivate`),
      b.put(`/api/credit-cards/${ids.cardId}`, { name: 'X' }),
      b.post(`/api/credit-cards/${ids.cardId}/deactivate`),
      b.put(`/api/transactions/${ids.manualId}`, { description: 'Invadido' }),
      b.post(`/api/transactions/${ids.manualId}/pay`, { paid_at: '2027-10-20' }),
      b.delete(`/api/transactions/${ids.manualId}`),
      b.delete(`/api/transactions/${ids.purchaseId}`),
      b.put(`/api/installment-plans/${ids.planId}`, { description: 'Invadido' }),
      b.delete(`/api/installment-plans/${ids.planId}`),
      b.post(`/api/invoices/${ids.invoiceId}/pay`, {
        paid_at: '2027-10-20',
        payment_method_id: ids.pix,
      }),
      b.put(`/api/recurrences/${ids.recurrenceId}`, { amount: 1 }),
      b.post(`/api/recurrences/${ids.recurrenceId}/cancel`, { cancelled_at: '2027-10-20' }),
      b.post(`/api/recurrences/${ids.recurrenceId}/occurrences/2027-11/skip`),
    ];
    for (const res of await Promise.all(attempts)) {
      expect(res.status, `${res.req.method} ${res.req.path}`).toBe(404);
    }

    expect(await prisma.category.findMany({ orderBy: { id: 'asc' } })).toEqual(before.categories);
    expect(await prisma.transaction.findMany({ orderBy: { id: 'asc' } })).toEqual(
      before.transactions,
    );
    expect(await prisma.recurrence.findMany()).toEqual(before.recurrences);
    expect(await prisma.invoice.findMany({ orderBy: { id: 'asc' } })).toEqual(before.invoices);
  });

  it('criar referenciando categoria, método, cartão ou compra de A → não encontrado', async () => {
    const ids = await seedA();
    const myCategory = await b.category('Mercado');
    const myPix = await b.systemMethod('PIX');

    const withACategory = await b.post('/api/transactions', {
      description: 'X',
      amount: 100,
      due_date: '2027-10-25',
      category_id: ids.category,
      payment_method_id: myPix,
    });
    expect(withACategory.status).toBe(404);
    expect(withACategory.body.error.code).toBe('CATEGORY_NOT_FOUND');

    const withAMethod = await b.post('/api/transactions', {
      description: 'X',
      amount: 100,
      due_date: '2027-10-25',
      category_id: myCategory,
      payment_method_id: ids.pix,
    });
    expect(withAMethod.status).toBe(404);
    expect(withAMethod.body.error.code).toBe('PAYMENT_METHOD_NOT_FOUND');

    const onACard = await b.post('/api/transactions', {
      description: 'X',
      amount: 100,
      purchase_date: '2027-10-10',
      category_id: myCategory,
      payment_method_id: ids.cardMethod,
    });
    expect(onACard.status).toBe(404);

    const recurrenceOnA = await b.post('/api/recurrences', {
      description: 'X',
      amount: 100,
      category_id: ids.category,
      payment_method_id: myPix,
      due_day: 10,
      start_date: '2027-10-01',
    });
    expect(recurrenceOnA.status).toBe(404);

    const refundOfA = await b.post('/api/refunds', {
      transaction_id: ids.purchaseId,
      amount: 100,
      refund_date: '2027-10-15',
    });
    expect(refundOfA.status).toBe(404);
    const planRefundOfA = await b.post('/api/refunds', {
      installment_plan_id: ids.planId,
      amount: 100,
      refund_date: '2027-10-15',
      strategy: 'PROPORTIONAL',
    });
    expect(planRefundOfA.status).toBe(404);

    // B paga a própria fatura com o PIX de A → método não encontrado
    const myCard = await b.card('Inter');
    const myPurchase = await b.post('/api/transactions', {
      description: 'Y',
      amount: 100,
      purchase_date: '2027-10-10',
      category_id: myCategory,
      payment_method_id: myCard.methodId,
    });
    const pay = await b.post(`/api/invoices/${myPurchase.body.invoice.id}/pay`, {
      paid_at: '2027-10-20',
      payment_method_id: ids.pix,
    });
    expect(pay.status).toBe(404);
    expect(pay.body.error.code).toBe('PAYMENT_METHOD_NOT_FOUND');

    expect(await prisma.transaction.count({ where: { userId: userB.userId } })).toBe(1);
  });
});

describe('regras por usuário (CA-AUTH-10)', () => {
  beforeEach(() => setup());

  it('nomes únicos valem por usuário', async () => {
    await a.category('Mercado');
    await a.method('Vale');
    await a.card('Nubank');
    expect((await b.post('/api/categories', { name: 'MERCADO', type: 'EXPENSE' })).status).toBe(
      201,
    );
    expect((await b.post('/api/payment-methods', { name: 'vale' })).status).toBe(201);
    expect(
      (await b.post('/api/credit-cards', { name: 'Nubank', best_purchase_day: 1, due_day: 10 }))
        .status,
    ).toBe(201);
    // dentro do mesmo usuário a unicidade continua
    const dup = await a.post('/api/categories', { name: 'mercado', type: 'EXPENSE' });
    expect(dup.status).toBe(409);
    expect(dup.body.error.code).toBe('CATEGORY_NAME_TAKEN');
  });

  it('fechar o mês de A não fecha o mês de B', async () => {
    const close = await a.post('/api/financial-periods/2027-10/close');
    expect(close.status).toBe(200);
    expect(close.body.status).toBe('CLOSED');

    expect((await b.get('/api/financial-periods/2027-10')).body.status).toBe('OPEN');
    const category = await b.category('Casa');
    const pix = await b.systemMethod('PIX');
    const created = await b.post('/api/transactions', {
      description: 'Conta',
      amount: 1000,
      due_date: '2027-10-25',
      category_id: category,
      payment_method_id: pix,
    });
    expect(created.status).toBe(201);

    // e o mês de A segue fechado para A
    const aCategory = await a.category('Casa');
    const aPix = await a.systemMethod('PIX');
    const blocked = await a.post('/api/transactions', {
      description: 'Conta',
      amount: 1000,
      due_date: '2027-10-25',
      category_id: aCategory,
      payment_method_id: aPix,
    });
    expect(blocked.status).toBe(409);
    expect(blocked.body.error.code).toBe('PERIOD_CLOSED');
  });

  it('B pode fechar o mesmo mês depois de A', async () => {
    expect((await a.post('/api/financial-periods/2027-10/close')).status).toBe(200);
    expect((await b.post('/api/financial-periods/2027-10/close')).status).toBe(200);
    expect(await prisma.financialPeriod.count({ where: { referenceMonth: '2027-10' } })).toBe(2);
  });
});

describe('geração de ocorrências por usuário', () => {
  const createRec = async (api: Api) => {
    const category = await api.category('Academia');
    const pix = await api.systemMethod('PIX');
    const res = await api.post('/api/recurrences', {
      description: 'Academia',
      amount: 10000,
      category_id: category,
      payment_method_id: pix,
      due_day: 25,
      start_date: '2027-10-01',
    });
    expect(res.status).toBe(201);
  };
  const occurrencesOf = (userId: string) =>
    prisma.transaction.count({ where: { userId, origin: 'RECURRENCE' } });

  beforeEach(async () => {
    await setup('2027-10-20');
    await createRec(a);
    await createRec(b);
  });

  it("o acesso de A gera só as de A e não consome a marca d'água de B", async () => {
    goto('2027-10-25');
    await a.get('/api/transactions');
    expect(await occurrencesOf(env.userId)).toBe(1);
    expect(await occurrencesOf(userB.userId)).toBe(0);

    await b.get('/api/transactions');
    expect(await occurrencesOf(userB.userId)).toBe(1);
    expect(await occurrencesOf(env.userId)).toBe(1);
  });

  it('a rotina periódica gera para todos os usuários', async () => {
    goto('2027-10-25');
    await refreshAllUsers({ prisma, clock: env.clock });
    expect(await occurrencesOf(env.userId)).toBe(1);
    expect(await occurrencesOf(userB.userId)).toBe(1);
  });
});
