import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { generateDueOccurrences } from '../../src/modules/recurrences/occurrences.js';
import { parseLocalDate } from '../../src/shared/dates.js';
import { Api, prisma, setupEnv, type TestEnv } from './helpers.js';

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
  cardMethod = (await api.card('Nubank', 6, 15)).methodId;
};

const cardBuy = (purchaseDate: string, amount = 10000) =>
  api.post('/api/transactions', {
    description: 'Compra',
    amount,
    purchase_date: purchaseDate,
    category_id: expense,
    payment_method_id: cardMethod,
  });
const payInvoice = (invoiceId: string, paidAt: string) =>
  api.post(`/api/invoices/${invoiceId}/pay`, { paid_at: paidAt, payment_method_id: pix });
const statuses = (responses: { status: number }[]): number[] =>
  responses.map((r) => r.status).sort();

describe('proteção contra concorrência (T-34, architecture §20)', () => {
  beforeEach(() => setup('2027-10-20'));

  it('dois pagamentos simultâneos da mesma fatura: um vence, o outro é rejeitado', async () => {
    const buy = await cardBuy('2027-10-05');
    const id = buy.body.invoice.id as string;
    const results = await Promise.all([1, 2, 3, 4].map(() => payInvoice(id, '2027-10-14')));
    expect(statuses(results)).toEqual([200, 409, 409, 409]);
    for (const r of results.filter((x) => x.status === 409)) {
      expect(r.body.error.code).toBe('INVOICE_ALREADY_PAID');
    }
    expect((await api.get(`/api/invoices/${id}`)).body).toMatchObject({
      status: 'PAID',
      paid_at: '2027-10-14',
    });
  });

  it('pagamento concorrente com novas postagens: nunca sobra lançamento pendente em fatura paga', async () => {
    const first = await cardBuy('2027-10-04');
    const id = first.body.invoice.id as string;
    const results = await Promise.all([
      payInvoice(id, '2027-10-14'),
      ...Array.from({ length: 6 }, (_, i) => cardBuy('2027-10-05', 1000 + i)),
    ]);
    expect(results.every((r) => r.status === 200 || r.status === 201)).toBe(true);
    const inPaid = await prisma.transaction.findMany({ where: { invoiceId: id } });
    expect(inPaid.every((t) => t.status === 'PAID')).toBe(true);
    const invoice = await prisma.invoice.findUniqueOrThrow({ where: { id } });
    expect(invoice.status).toBe('PAID');
    // as compras que perderam a corrida foram para a próxima fatura (compra tardia)
    const total = await prisma.transaction.count();
    expect(total).toBe(7);
    const orphans = await prisma.transaction.count({
      where: { status: 'PENDING', invoice: { status: 'PAID' } },
    });
    expect(orphans).toBe(0);
  });

  it('criação simultânea de faturas do mesmo cartão e mês gera uma única fatura', async () => {
    const results = await Promise.all(Array.from({ length: 8 }, () => cardBuy('2027-10-05')));
    expect(results.every((r) => r.status === 201)).toBe(true);
    expect(await prisma.invoice.count()).toBe(1);
    expect(await prisma.transaction.count()).toBe(8);
    const parcels = await Promise.all(
      Array.from({ length: 4 }, () =>
        api.post('/api/transactions', {
          description: 'TV',
          amount: 40000,
          purchase_date: '2027-10-05',
          category_id: expense,
          payment_method_id: cardMethod,
          installment_count: 4,
        }),
      ),
    );
    expect(parcels.every((r) => r.status === 201)).toBe(true);
    const months = await prisma.invoice.findMany({ select: { referenceMonth: true } });
    expect(new Set(months.map((m) => m.referenceMonth)).size).toBe(months.length);
    expect(months).toHaveLength(4); // out, nov, dez, jan
  });

  it('dois estornos simultâneos da mesma compra respeitam o limite estornável', async () => {
    const buy = await cardBuy('2027-10-05', 10000);
    const refund = () =>
      api.post('/api/refunds', {
        transaction_id: buy.body.id,
        amount: 6000,
        refund_date: '2027-10-10',
      });
    const results = await Promise.all([refund(), refund(), refund()]);
    expect(statuses(results)).toEqual([201, 422, 422]);
    for (const r of results.filter((x) => x.status === 422)) {
      expect(r.body.error.code).toBe('REFUND_EXCEEDS_REMAINING_AMOUNT');
    }
    const allocated = await prisma.refundAllocation.aggregate({ _sum: { amount: true } });
    expect(allocated._sum.amount).toBe(6000);
  });

  it('estornos simultâneos de plano parcelado respeitam o saldo por parcela', async () => {
    const plan = await api.post('/api/transactions', {
      description: 'TV',
      amount: 40000,
      purchase_date: '2027-10-05',
      category_id: expense,
      payment_method_id: cardMethod,
      installment_count: 4,
    });
    const planId = plan.body.installment_plan.id as string;
    const refund = (strategy: string) =>
      api.post('/api/refunds', {
        installment_plan_id: planId,
        amount: 25000,
        refund_date: '2027-10-10',
        strategy,
      });
    const results = await Promise.all([
      refund('FIRST_INSTALLMENTS'),
      refund('LAST_INSTALLMENTS'),
      refund('PROPORTIONAL'),
    ]);
    expect(results.filter((r) => r.status === 201)).toHaveLength(1);
    const total = await prisma.refundAllocation.aggregate({ _sum: { amount: true } });
    expect(total._sum.amount).toBe(25000);
  });

  it('fechamento duplicado: um fecha, os outros veem o mês fechado', async () => {
    const t = await api.post('/api/transactions', {
      description: 'A',
      amount: 1000,
      due_date: '2027-10-05',
      category_id: expense,
      payment_method_id: pix,
    });
    await api.post(`/api/transactions/${t.body.id}/pay`, { paid_at: '2027-10-05' });
    const results = await Promise.all(
      [1, 2, 3].map(() => api.post('/api/financial-periods/2027-10/close')),
    );
    expect(statuses(results)).toEqual([200, 409, 409]);
    for (const r of results.filter((x) => x.status === 409)) {
      expect(r.body.error.code).toBe('PERIOD_CLOSED');
    }
    expect(await prisma.financialPeriod.count()).toBe(1);
  });

  it('fechamento concorrente com criação de lançamento no mês: resultado sempre consistente', async () => {
    const created = await api.post('/api/transactions', {
      description: 'Base',
      amount: 1000,
      due_date: '2027-10-05',
      category_id: expense,
      payment_method_id: pix,
    });
    await api.post(`/api/transactions/${created.body.id}/pay`, { paid_at: '2027-10-05' });

    const [closeRes, createRes] = await Promise.all([
      api.post('/api/financial-periods/2027-10/close'),
      api.post('/api/transactions', {
        description: 'Concorrente',
        amount: 500,
        due_date: '2027-10-25',
        category_id: expense,
        payment_method_id: pix,
      }),
    ]);

    const pending = await prisma.transaction.count({
      where: { financialMonth: '2027-10', status: 'PENDING' },
    });
    const period = await prisma.financialPeriod.findFirst({
      where: { referenceMonth: '2027-10' },
    });
    if (closeRes.status === 200) {
      // fechou: a criação não pode ter entrado depois do fechamento
      expect(period?.status).toBe('CLOSED');
      expect(createRes.status).toBe(409);
      expect(createRes.body.error.code).toBe('PERIOD_CLOSED');
      expect(pending).toBe(0);
    } else {
      // a criação venceu: o fechamento viu o lançamento pendente
      expect(createRes.status).toBe(201);
      expect(closeRes.body.error.code).toBe('PERIOD_HAS_PENDING_TRANSACTIONS');
      expect(period).toBeNull();
      expect(pending).toBe(1);
    }
  });

  it('fechamento concorrente com pagamento de fatura do mês', async () => {
    const buy = await cardBuy('2027-10-05');
    const [closeRes, payRes] = await Promise.all([
      api.post('/api/financial-periods/2027-10/close'),
      payInvoice(buy.body.invoice.id, '2027-10-14'),
    ]);
    expect(payRes.status).toBe(200);
    // O fechamento pode ter lido o mês antes ou depois do pagamento, mas nunca fecha com pendência.
    if (closeRes.status === 200) {
      expect(
        await prisma.transaction.count({ where: { financialMonth: '2027-10', status: 'PENDING' } }),
      ).toBe(0);
    } else {
      expect(['PERIOD_HAS_PENDING_TRANSACTIONS', 'PERIOD_HAS_UNPAID_INVOICES']).toContain(
        closeRes.body.error.code,
      );
    }
  });

  it('geração duplicada de ocorrência: execuções simultâneas geram uma só', async () => {
    await api.post('/api/recurrences', {
      description: 'Aluguel',
      amount: 150000,
      category_id: expense,
      payment_method_id: pix,
      due_day: 25,
      start_date: '2027-10-01',
    });
    env.clock.set(parseLocalDate('2027-10-25'));
    const { ctx } = env;
    await Promise.all([
      ...Array.from({ length: 4 }, () => generateDueOccurrences(ctx)),
      ...Array.from({ length: 4 }, () => generateDueOccurrences(ctx, { fromToday: true })),
      ...Array.from({ length: 4 }, () => api.get('/api/transactions')),
    ]);
    expect(await prisma.transaction.count({ where: { origin: 'RECURRENCE' } })).toBe(1);
  });

  it('pular ocorrência concorrente com geração: nunca existem lançamento e exceção juntos', async () => {
    const rec = await api.post('/api/recurrences', {
      description: 'Luz',
      amount: 20000,
      category_id: expense,
      payment_method_id: pix,
      due_day: 25,
      start_date: '2027-10-01',
    });
    env.clock.set(parseLocalDate('2027-10-25'));
    const { ctx } = env;
    await Promise.all([
      api.post(`/api/recurrences/${rec.body.id}/occurrences/2027-10/skip`),
      generateDueOccurrences(ctx, { fromToday: true }),
      api.get('/api/transactions'),
    ]);
    const txs = await prisma.transaction.count({
      where: { origin: 'RECURRENCE', occurrenceMonth: '2027-10' },
    });
    const exceptions = await prisma.recurrenceException.count({
      where: { occurrenceMonth: '2027-10' },
    });
    expect(txs + exceptions).toBeLessThanOrEqual(1);
    expect(txs === 1 && exceptions === 1).toBe(false);
  });
});
