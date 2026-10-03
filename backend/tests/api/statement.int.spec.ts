import { afterAll, describe, expect, it } from 'vitest';
import { parseLocalDate } from '../../src/shared/dates.js';
import { Api, prisma, setupEnv, type TestEnv } from './helpers.js';

let env: TestEnv;
let api: Api;
let expense: string;
let income: string;
let pix: string;

afterAll(() => prisma.$disconnect());

const setup = async (today: string) => {
  env = await setupEnv(today);
  api = new Api(env);
  expense = await api.category('Despesas', 'EXPENSE');
  income = await api.category('Receitas', 'INCOME');
  pix = await api.systemMethod('PIX');
};
const goto = (date: string) => env.clock.set(parseLocalDate(date));

interface Item {
  item_type: string;
  display_date: string;
  description: string;
  amount: number;
  signed_amount: number;
  nature: string;
  status: string | null;
  installment: { number: number; installment_count: number } | null;
  invoice: { reference_month: string; due_date: string } | null;
}
const statement = async (month: string) =>
  (await api.get(`/api/monthly-statement?month=${month}`)).body as {
    month: { status: string };
    totals: { incomes: number; expenses: number; balance: number };
    items: Item[];
  };

const cardBuy = (
  methodId: string,
  purchaseDate: string,
  amount: number,
  description: string,
  extra = {},
) =>
  api.post('/api/transactions', {
    description,
    amount,
    purchase_date: purchaseDate,
    category_id: expense,
    payment_method_id: methodId,
    ...extra,
  });
const manual = (
  description: string,
  amount: number,
  dueDate: string,
  type: 'INCOME' | 'EXPENSE' = 'EXPENSE',
) =>
  api.post('/api/transactions', {
    description,
    amount,
    due_date: dueDate,
    category_id: type === 'INCOME' ? income : expense,
    payment_method_id: pix,
  });

describe('extrato de janeiro/2027 (home.md §4, CA-HOME-02/06/07/12)', () => {
  it('reproduz o exemplo: entradas 8.800, saídas 2.759, saldo 6.041', async () => {
    await setup('2026-11-20');
    const nubank = await api.card('Nubank', 6, 15);
    // Tênis (comprado em novembro, fatura de dezembro) — será estornado em 03/01
    const tenis = await cardBuy(nubank.methodId, '2026-11-20', 30000, 'Tênis');
    // Netflix: recorrência com cartão, dia 10 (ocorrência de 10/12 cai na fatura de janeiro)
    await api.post('/api/recurrences', {
      description: 'Netflix',
      amount: 6000,
      category_id: expense,
      payment_method_id: nubank.methodId,
      due_day: 10,
      start_date: '2026-11-01',
    });
    goto('2026-11-28');
    // Coxim do motor: 10x de R$ 59,00 (compra em 28/11) — parcela 2/10 cai em janeiro
    const coxim = await cardBuy(
      nubank.methodId,
      '2026-11-28',
      59000,
      'Mercado Livre — Coxim do motor',
      { installment_count: 10 },
    );
    expect(coxim.status).toBe(201);
    goto('2026-12-20');
    await cardBuy(nubank.methodId, '2026-12-20', 64000, 'Supermercado');
    goto('2027-01-03');
    const refund = await api.post('/api/refunds', {
      transaction_id: tenis.body.id,
      amount: 10000,
      refund_date: '2027-01-03',
    });
    expect(refund.status).toBe(201);
    expect(refund.body.allocations[0].invoice_reference_month).toBe('2027-01');
    const salary = await manual('Salário', 850000, '2027-01-05', 'INCOME');
    await manual('Aluguel', 150000, '2027-01-05');
    await manual('Internet', 12000, '2027-01-06');
    await manual('Gasolina', 30000, '2027-01-07');
    await manual('Luz', 18000, '2027-01-10');
    await manual('Freelance', 30000, '2027-01-20', 'INCOME');
    goto('2027-01-05');
    await api.post(`/api/transactions/${salary.body.id}/pay`, { paid_at: '2027-01-05' });

    const jan = await statement('2027-01');
    expect(jan.month.status).toBe('OPEN');
    expect(jan.totals).toEqual({ incomes: 880000, expenses: 275900, balance: 604100 });
    expect(
      jan.items.map((i) => [i.display_date, i.description, i.signed_amount, i.status]),
    ).toEqual([
      ['2026-11-28', 'Mercado Livre — Coxim do motor', -5900, 'PENDING'],
      ['2026-12-10', 'Netflix', -6000, 'PENDING'],
      ['2026-12-20', 'Supermercado', -64000, 'PENDING'],
      ['2027-01-03', 'Estorno — Tênis', 10000, null],
      ['2027-01-05', 'Salário', 850000, 'PAID'],
      ['2027-01-05', 'Aluguel', -150000, 'PENDING'],
      ['2027-01-06', 'Internet', -12000, 'PENDING'],
      ['2027-01-07', 'Gasolina', -30000, 'PENDING'],
      ['2027-01-10', 'Luz', -18000, 'PENDING'],
      ['2027-01-20', 'Freelance', 30000, 'PENDING'],
    ]);
    const parcel = jan.items[0];
    expect(parcel?.installment).toEqual({
      number: 2,
      installment_count: 10,
      installment_plan_id: expect.any(String),
    });
    expect(jan.items[3]).toMatchObject({
      item_type: 'REFUND_CREDIT',
      nature: 'EXPENSE',
      amount: 10000,
    });
    // itens de cartão dizem a fatura (vence 15/01); não há linha agregada nem total da compra parcelada
    expect(jan.items[2]?.invoice).toMatchObject({
      reference_month: '2027-01',
      due_date: '2027-01-15',
    });
    expect(jan.items.some((i) => i.amount === 590000)).toBe(false);
    expect(jan.items.filter((i) => i.item_type === 'TRANSACTION' && i.invoice)).toHaveLength(3);

    // CA-HOME-03: pagar não muda o saldo previsto
    const aluguel = (await api.get('/api/transactions?month=2027-01&origin=MANUAL')).body.data.find(
      (t: { description: string }) => t.description === 'Aluguel',
    );
    await api.post(`/api/transactions/${aluguel.id}/pay`, { paid_at: '2027-01-05' });
    expect((await statement('2027-01')).totals).toEqual(jan.totals);

    // CA-HOME-08: pagar a fatura não altera os totais; o saldo credor não entra nos cálculos
    goto('2027-01-20');
    const invoice = (await api.get('/api/transactions?month=2027-01&origin=INSTALLMENT')).body
      .data[0].invoice.id;
    const pay = await api.post(`/api/invoices/${invoice}/pay`, {
      paid_at: '2027-01-18',
      payment_method_id: pix,
    });
    expect(pay.status).toBe(200);
    const after = await statement('2027-01');
    expect(after.totals).toEqual(jan.totals);
    expect(
      after.items.filter((i) => i.item_type === 'TRANSACTION' && i.status === 'PAID'),
    ).toHaveLength(5);
  });
});

describe('inclusão por mês financeiro', () => {
  it('CA-HOME-04: compra de 07/10 (melhor dia 6) aparece em novembro', async () => {
    await setup('2027-10-10');
    const card = await api.card('Nubank', 6, 15);
    await cardBuy(card.methodId, '2027-10-07', 5000, 'Compra');
    expect((await statement('2027-10')).items).toHaveLength(0);
    const nov = await statement('2027-11');
    expect(nov.items).toHaveLength(1);
    expect(nov.items[0]).toMatchObject({ display_date: '2027-10-07', description: 'Compra' });
  });

  it('CA-HOME-05: compra de 20/10 (melhor dia 25, vencimento 5) aparece em outubro', async () => {
    await setup('2027-10-20');
    const card = await api.card('Nubank', 25, 5);
    await cardBuy(card.methodId, '2027-10-20', 5000, 'Compra');
    const oct = await statement('2027-10');
    expect(oct.items).toHaveLength(1);
    expect(oct.items[0]?.invoice).toMatchObject({
      reference_month: '2027-10',
      due_date: '2027-11-05',
    });
    expect((await statement('2027-11')).items).toHaveLength(0);
  });

  it('CA-HOME-06: 10x → uma parcela por mês com n/10, sem linha com o valor total', async () => {
    await setup('2027-10-01');
    const card = await api.card('Nubank', 6, 15);
    await cardBuy(card.methodId, '2027-10-05', 100000, 'TV', { installment_count: 10 });
    for (const [month, n] of [
      ['2027-10', 1],
      ['2027-12', 3],
      ['2028-07', 10],
    ] as const) {
      const s = await statement(month);
      expect(s.items).toHaveLength(1);
      expect(s.items[0]?.installment).toMatchObject({ number: n, installment_count: 10 });
      expect(s.items[0]?.amount).toBe(10000);
      expect(s.totals.expenses).toBe(10000);
    }
  });

  it('CA-HOME-09: mês futuro mostra ocorrências projetadas de recorrências ativas', async () => {
    await setup('2027-10-01');
    await api.post('/api/recurrences', {
      description: 'Aluguel',
      amount: 150000,
      category_id: expense,
      payment_method_id: pix,
      due_day: 5,
      start_date: '2027-10-01',
    });
    const future = await statement('2028-03');
    expect(future.items).toEqual([
      expect.objectContaining({
        item_type: 'PROJECTED_OCCURRENCE',
        display_date: '2028-03-05',
        status: 'PENDING',
        origin: 'RECURRENCE',
      }),
    ]);
    expect(future.totals).toEqual({ incomes: 0, expenses: 150000, balance: -150000 });
  });

  it('status não altera totais; mês fechado é exibido como fechado', async () => {
    await setup('2027-09-30');
    const a = await manual('A', 100000, '2027-09-10', 'INCOME');
    await manual('B', 30000, '2027-09-12');
    const before = await statement('2027-09');
    await api.post(`/api/transactions/${a.body.id}/pay`, { paid_at: '2027-09-10' });
    const paid = await statement('2027-09');
    expect(paid.totals).toEqual(before.totals);
    expect(paid.totals).toEqual({ incomes: 100000, expenses: 30000, balance: 70000 });
    await prisma.financialPeriod.create({
      data: { referenceMonth: '2027-08', status: 'CLOSED', closedAt: new Date() },
    });
    expect((await statement('2027-08')).month.status).toBe('CLOSED');
  });

  it('crédito de estorno de compra de categoria INCOME abate as entradas', async () => {
    await setup('2027-10-06');
    const card = await api.card('Nubank', 6, 15);
    const buy = await api.post('/api/transactions', {
      description: 'Venda no cartão',
      amount: 20000,
      purchase_date: '2027-10-05',
      category_id: income,
      payment_method_id: card.methodId,
    });
    await api.post('/api/refunds', {
      transaction_id: buy.body.id,
      amount: 5000,
      refund_date: '2027-10-06',
    });
    const oct = await statement('2027-10');
    expect(oct.totals).toEqual({ incomes: 15000, expenses: 0, balance: 15000 });
    expect(oct.items.find((i) => i.item_type === 'REFUND_CREDIT')?.signed_amount).toBe(-5000);
  });

  it('mês inválido → 400', async () => {
    await setup('2027-10-01');
    expect((await api.get('/api/monthly-statement?month=2027-13')).status).toBe(400);
    expect((await api.get('/api/monthly-statement')).status).toBe(400);
  });
});
