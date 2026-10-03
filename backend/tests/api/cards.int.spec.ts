import { afterAll, describe, expect, it } from 'vitest';
import type { PrismaClient } from '@prisma/client';
import { createApp } from '../../src/app.js';
import { parseLocalDate } from '../../src/shared/dates.js';
import { Api, prisma, setupEnv, type TestEnv } from './helpers.js';
import request from 'supertest';

let env: TestEnv;
let api: Api;
let category: string;
let pix: string;

afterAll(() => prisma.$disconnect());

const setup = async (today: string, best = 6, due = 15) => {
  env = await setupEnv(today);
  api = new Api(env);
  category = await api.category('Compras', 'EXPENSE');
  pix = await api.systemMethod('PIX');
  return api.card('Nubank', best, due);
};

const buy = (methodId: string, purchaseDate: string, extra: Record<string, unknown> = {}) =>
  api.post('/api/transactions', {
    description: 'Compra',
    amount: 10000,
    purchase_date: purchaseDate,
    category_id: category,
    payment_method_id: methodId,
    ...extra,
  });

const invoiceOf = async (id: string) => (await api.get(`/api/invoices/${id}`)).body;
const payInvoice = (invoiceId: string, paidAt: string, methodId = pix) =>
  api.post(`/api/invoices/${invoiceId}/pay`, { paid_at: paidAt, payment_method_id: methodId });

describe('compra à vista no cartão (T-22)', () => {
  it('CA-CAR-02: melhor dia 6 — 05/10 e 06/10 em outubro, 07/10 em novembro', async () => {
    const { methodId } = await setup('2027-10-20');
    const months: string[] = [];
    for (const date of ['2027-10-05', '2027-10-06', '2027-10-07']) {
      const res = await buy(methodId, date);
      expect(res.status).toBe(201);
      months.push(res.body.financial_month);
    }
    expect(months).toEqual(['2027-10', '2027-10', '2027-11']);
  });

  it('CA-FAT-01: primeira compra do ciclo cria a fatura OPEN com closing e due calculados', async () => {
    const { methodId, cardId } = await setup('2027-10-01');
    const res = await buy(methodId, '2027-10-05');
    expect(res.body).toMatchObject({
      origin: 'CREDIT_CARD',
      status: 'PENDING',
      purchase_date: '2027-10-05',
      financial_month: '2027-10',
      due_date: '2027-10-15',
    });
    const invoice = await invoiceOf(res.body.invoice.id);
    expect(invoice).toMatchObject({
      credit_card_id: cardId,
      status: 'OPEN',
      closing_date: '2027-10-06',
      due_date: '2027-10-15',
    });
    expect(await prisma.invoice.count()).toBe(1);
  });

  it('CA-FAT-02: ciclo já encerrado cria a fatura CLOSED', async () => {
    const { methodId } = await setup('2027-10-20');
    const res = await buy(methodId, '2027-10-05');
    expect(res.body.invoice.status).toBe('CLOSED');
  });

  it('CA-CAR-04: melhor dia 25, vencimento 5 — compra de 20/10 é de outubro e vence 05/11', async () => {
    const { methodId } = await setup('2027-10-20', 25, 5);
    const res = await buy(methodId, '2027-10-20');
    expect(res.body).toMatchObject({
      financial_month: '2027-10',
      due_date: '2027-11-05',
      purchase_date: '2027-10-20',
    });
  });

  it('CA-CAR-05: melhor dia 25 — compra de 26/10 vai para novembro e vence 05/12', async () => {
    const { methodId } = await setup('2027-10-20', 25, 5);
    const res = await buy(methodId, '2027-10-26');
    expect(res.body).toMatchObject({ financial_month: '2027-11', due_date: '2027-12-05' });
  });

  it('CA-CAR-08: fatura do ciclo CLOSED e não paga aceita a compra de 05/10 cadastrada em 20/10', async () => {
    const { methodId } = await setup('2027-10-20');
    const first = await buy(methodId, '2027-10-03');
    const late = await buy(methodId, '2027-10-05');
    expect(late.body.invoice.id).toBe(first.body.invoice.id);
    expect(late.body.invoice.status).toBe('CLOSED');
    expect(late.body.financial_month).toBe('2027-10');
  });

  it('CA-CAR-09: fatura de outubro PAID → compra tardia em novembro; outubro inalterado', async () => {
    const { methodId } = await setup('2027-10-20');
    const first = await buy(methodId, '2027-10-03');
    const oct = first.body.invoice.id as string;
    expect((await payInvoice(oct, '2027-10-14')).status).toBe(200);

    const late = await buy(methodId, '2027-10-05');
    expect(late.status).toBe(201);
    expect(late.body).toMatchObject({
      purchase_date: '2027-10-05',
      financial_month: '2027-11',
      due_date: '2027-11-15',
    });
    expect(late.body.invoice.id).not.toBe(oct);
    const after = await invoiceOf(oct);
    expect(after.status).toBe('PAID');
    expect(after.transactions).toHaveLength(1);
    expect(after.totals.debits).toBe(10000);
  });

  it('compra tardia também pula mês financeiro fechado', async () => {
    const { methodId } = await setup('2027-10-20');
    await prisma.financialPeriod.create({
      data: { referenceMonth: '2027-10', status: 'CLOSED', closedAt: new Date() },
    });
    const res = await buy(methodId, '2027-10-05');
    expect(res.body.financial_month).toBe('2027-11');
  });

  it('CA-CAR-11: após mudar o melhor dia, fatura persistida mantém o fechamento', async () => {
    const { methodId, cardId } = await setup('2027-10-03');
    await buy(methodId, '2027-10-03'); // cria outubro (closing 06/10)
    await api.put(`/api/credit-cards/${cardId}`, { best_purchase_day: 10 });
    env.clock.set(parseLocalDate('2027-10-08'));
    const res = await buy(methodId, '2027-10-08');
    expect(res.body.financial_month).toBe('2027-11');
    expect(res.body.invoice.closing_date).toBe('2027-11-10');
    const invoices = await api.get(`/api/credit-cards/${cardId}/invoices?from=2027-10&to=2027-10`);
    expect(invoices.body.data[0].closing_date).toBe('2027-10-06');
  });

  it('CA-FAT-15: alterar due_day não altera o due_date de faturas persistidas', async () => {
    const { methodId, cardId } = await setup('2027-10-01');
    const res = await buy(methodId, '2027-10-05');
    await api.put(`/api/credit-cards/${cardId}`, { due_day: 28 });
    expect((await invoiceOf(res.body.invoice.id)).due_date).toBe('2027-10-15');
  });

  it('CA-CAR-12: valor e cartão de compra realizada são imutáveis', async () => {
    const { methodId } = await setup('2027-10-01');
    const other = (await api.card('Inter')).methodId;
    const res = await buy(methodId, '2027-10-05');
    for (const body of [{ amount: 20000 }, { payment_method_id: other }]) {
      const edit = await api.put(`/api/transactions/${res.body.id}`, body);
      expect(edit.status).toBe(409);
      expect(edit.body.error.code).toBe('TRANSACTION_NOT_EDITABLE');
    }
  });

  it('CA-CAR-13: compra de cartão não é excluída', async () => {
    const { methodId } = await setup('2027-10-01');
    const res = await buy(methodId, '2027-10-05');
    const del = await api.delete(`/api/transactions/${res.body.id}`);
    expect(del.status).toBe(409);
    expect(del.body.error.code).toBe('TRANSACTION_NOT_DELETABLE');
  });

  it('CA-CAR-16: purchase_date é imutável', async () => {
    const { methodId } = await setup('2027-10-01');
    const res = await buy(methodId, '2027-10-05');
    const edit = await api.put(`/api/transactions/${res.body.id}`, { purchase_date: '2027-10-06' });
    expect(edit.body.error.code).toBe('TRANSACTION_NOT_EDITABLE');
  });

  it('CA-CAR-15: janela de registro (hoje 29/09)', async () => {
    const { methodId } = await setup('2027-09-29');
    expect((await buy(methodId, '2027-09-10')).status).toBe(201);
    expect((await buy(methodId, '2027-10-05')).status).toBe(201);
    const res = await buy(methodId, '2027-08-10');
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('INVALID_PURCHASE_DATE');
  });

  it('exige purchase_date e rejeita cartão inativo e categoria inativa', async () => {
    const { methodId, cardId } = await setup('2027-10-01');
    const missing = await api.post('/api/transactions', {
      description: 'X',
      amount: 100,
      category_id: category,
      payment_method_id: methodId,
    });
    expect(missing.body.error.code).toBe('INVALID_PURCHASE_DATE');
    await api.post(`/api/credit-cards/${cardId}/deactivate`);
    expect((await buy(methodId, '2027-10-05')).body.error.code).toBe('CARD_INACTIVE');
  });

  it('CA-TRA-19: marcar compra de cartão como paga individualmente é rejeitado', async () => {
    const { methodId } = await setup('2027-10-20');
    const res = await buy(methodId, '2027-10-05');
    for (const path of ['pay', 'unpay']) {
      const out = await api.post(`/api/transactions/${res.body.id}/${path}`, {
        paid_at: '2027-10-10',
      });
      expect(out.status).toBe(409);
      expect(out.body.error.code).toBe('CARD_TRANSACTION_SETTLED_BY_INVOICE');
    }
  });

  it('edita descrição e categoria (mesmo tipo) enquanto a fatura não está PAID; depois não', async () => {
    const { methodId } = await setup('2027-10-20');
    const res = await buy(methodId, '2027-10-05');
    const other = await api.category('Lazer', 'EXPENSE');
    const edit = await api.put(`/api/transactions/${res.body.id}`, {
      description: 'Nova',
      category_id: other,
    });
    expect(edit.status).toBe(200);
    expect(edit.body).toMatchObject({ description: 'Nova' });
    await payInvoice(res.body.invoice.id, '2027-10-14');
    for (const body of [{ description: 'Outra' }, { category_id: category }]) {
      const blocked = await api.put(`/api/transactions/${res.body.id}`, body);
      expect(blocked.status).toBe(409);
      expect(blocked.body.error.code).toBe('INVOICE_ALREADY_PAID');
    }
  });
});

describe('leitura de faturas (T-23, T-24)', () => {
  it('CA-FAT-03: OPEN passa a CLOSED no dia seguinte ao fechamento (idempotente)', async () => {
    const { methodId } = await setup('2027-10-01');
    const res = await buy(methodId, '2027-10-05');
    const id = res.body.invoice.id as string;
    env.clock.set(parseLocalDate('2027-10-06'));
    expect((await invoiceOf(id)).status).toBe('OPEN');
    env.clock.set(parseLocalDate('2027-10-07'));
    expect((await invoiceOf(id)).status).toBe('CLOSED');
    expect((await invoiceOf(id)).status).toBe('CLOSED');
    expect((await api.get('/api/transactions')).body.data[0].invoice.status).toBe('CLOSED');
  });

  it('detalhe com lançamentos e totais', async () => {
    const { methodId } = await setup('2027-10-20');
    const a = await buy(methodId, '2027-10-03');
    await buy(methodId, '2027-10-04', { amount: 5000 });
    const invoice = await invoiceOf(a.body.invoice.id);
    expect(invoice.transactions).toHaveLength(2);
    expect(invoice.totals).toMatchObject({ debits: 15000, credits: 0, amount_due: 15000 });
    expect(invoice.card_name).toBe('Nubank');
  });

  it('CA-FAT-13: CLOSED com vencimento passado é atrasada e continua no mês de referência', async () => {
    const { methodId } = await setup('2027-09-20');
    const res = await buy(methodId, '2027-09-03');
    const invoice = await invoiceOf(res.body.invoice.id);
    expect(invoice).toMatchObject({
      status: 'CLOSED',
      due_date: '2027-09-15',
      situation: 'OVERDUE',
      reference_month: '2027-09',
    });
  });

  it('CA-FAT-16: ciclos futuros sem lançamentos são projetados, não persistidos', async () => {
    const { methodId, cardId } = await setup('2028-01-10');
    await buy(methodId, '2028-01-03');
    const list = await api.get(`/api/credit-cards/${cardId}/invoices?from=2028-01&to=2028-04`);
    const data = list.body.data as {
      id: string | null;
      persisted: boolean;
      reference_month: string;
      totals: { amount_due: number };
    }[];
    expect(data.map((i) => i.reference_month)).toEqual([
      '2028-01',
      '2028-02',
      '2028-03',
      '2028-04',
    ]);
    expect(data[0]?.persisted).toBe(true);
    for (const projected of data.slice(1)) {
      expect(projected).toMatchObject({ id: null, persisted: false, status: 'OPEN' });
      expect(projected.totals.amount_due).toBe(0);
    }
    expect(await prisma.invoice.count()).toBe(1);
    const feb = data[1] as unknown as { closing_date: string; due_date: string };
    expect(feb).toMatchObject({ closing_date: '2028-02-06', due_date: '2028-02-15' });
  });

  it('CA-FAT-17: cartão desativado continua mostrando e permitindo pagar faturas existentes', async () => {
    const { methodId, cardId } = await setup('2028-03-10');
    const plan = await buy(methodId, '2028-03-05', { installment_count: 5, amount: 50000 });
    expect(plan.status).toBe(201);
    await api.post(`/api/credit-cards/${cardId}/deactivate`);
    const list = await api.get(`/api/credit-cards/${cardId}/invoices?from=2028-03&to=2028-12`);
    const months = (list.body.data as { reference_month: string }[]).map((i) => i.reference_month);
    expect(months).toEqual(['2028-03', '2028-04', '2028-05', '2028-06', '2028-07']);
    const march = list.body.data[0] as { id: string };
    expect((await payInvoice(march.id, '2028-03-09')).status).toBe(200);
  });

  it('intervalo inválido → 400/422', async () => {
    const { cardId } = await setup('2027-10-01');
    expect((await api.get(`/api/credit-cards/${cardId}/invoices?from=2027-13`)).status).toBe(400);
    expect(
      (await api.get(`/api/credit-cards/${cardId}/invoices?from=2027-10&to=2027-01`)).status,
    ).toBe(422);
    expect((await api.get('/api/invoices/6f1c3c4e-0000-4000-8000-000000000000')).status).toBe(404);
  });
});

describe('pagar fatura (T-25)', () => {
  it('CA-FAT-04: fatura OPEN não pode ser paga', async () => {
    const { methodId } = await setup('2027-10-01');
    const res = await buy(methodId, '2027-10-05');
    const pay = await payInvoice(res.body.invoice.id, '2027-10-01');
    expect(pay.status).toBe(409);
    expect(pay.body.error.code).toBe('INVOICE_NOT_CLOSED');
  });

  it('CA-FAT-05: pagar liquida A, B e C com a data do pagamento', async () => {
    const { methodId } = await setup('2027-10-20');
    const a = await buy(methodId, '2027-10-02');
    await buy(methodId, '2027-10-03');
    await buy(methodId, '2027-10-04');
    const pay = await payInvoice(a.body.invoice.id, '2027-10-12');
    expect(pay.status).toBe(200);
    expect(pay.body).toMatchObject({
      status: 'PAID',
      paid_at: '2027-10-12',
      payment_method_id: pix,
    });
    for (const t of pay.body.transactions) {
      expect(t).toMatchObject({
        status: 'PAID',
        paid_at: '2027-10-12',
        financial_month: '2027-10',
      });
    }
    expect(pay.body.transactions).toHaveLength(3);
    // não cria lançamento
    expect(await prisma.transaction.count()).toBe(3);
  });

  it('CA-FAT-07: pagar com o próprio cartão é rejeitado', async () => {
    const { methodId } = await setup('2027-10-20');
    const a = await buy(methodId, '2027-10-02');
    const pay = await payInvoice(a.body.invoice.id, '2027-10-12', methodId);
    expect(pay.status).toBe(422);
    expect(pay.body.error.code).toBe('INVOICE_PAYMENT_METHOD_INVALID');
  });

  it('pagar com outro cartão é aceito', async () => {
    const { methodId } = await setup('2027-10-20');
    const other = await api.card('Inter');
    const a = await buy(methodId, '2027-10-02');
    expect((await payInvoice(a.body.invoice.id, '2027-10-12', other.methodId)).status).toBe(200);
  });

  it('CA-FAT-08: método inativo é rejeitado', async () => {
    const { methodId } = await setup('2027-10-20');
    const a = await buy(methodId, '2027-10-02');
    await api.post(`/api/payment-methods/${pix}/deactivate`);
    const pay = await payInvoice(a.body.invoice.id, '2027-10-12');
    expect(pay.body.error.code).toBe('PAYMENT_METHOD_INACTIVE');
  });

  it('CA-FAT-09: data futura ou em mês fechado é rejeitada', async () => {
    const { methodId } = await setup('2027-10-20');
    const a = await buy(methodId, '2027-10-02');
    expect((await payInvoice(a.body.invoice.id, '2027-10-21')).body.error.code).toBe(
      'INVALID_PAYMENT_DATE',
    );
    await prisma.financialPeriod.create({
      data: { referenceMonth: '2027-09', status: 'CLOSED', closedAt: new Date() },
    });
    expect((await payInvoice(a.body.invoice.id, '2027-09-30')).body.error.code).toBe(
      'INVALID_PAYMENT_DATE',
    );
  });

  it('CA-FAT-14: fatura PAID não é paga de novo nem reaberta', async () => {
    const { methodId } = await setup('2027-10-20');
    const a = await buy(methodId, '2027-10-02');
    await payInvoice(a.body.invoice.id, '2027-10-12');
    const again = await payInvoice(a.body.invoice.id, '2027-10-13');
    expect(again.status).toBe(409);
    expect(again.body.error.code).toBe('INVOICE_ALREADY_PAID');
  });

  it('mês financeiro fechado: fatura não pode ser paga (CA-PER-08)', async () => {
    const { methodId } = await setup('2027-10-20');
    const a = await buy(methodId, '2027-10-02');
    await prisma.financialPeriod.create({
      data: { referenceMonth: '2027-10', status: 'CLOSED', closedAt: new Date() },
    });
    expect((await payInvoice(a.body.invoice.id, '2027-10-12')).body.error.code).toBe(
      'PERIOD_CLOSED',
    );
  });

  it('validação do corpo', async () => {
    const { methodId } = await setup('2027-10-20');
    const a = await buy(methodId, '2027-10-02');
    expect(
      (await api.post(`/api/invoices/${a.body.invoice.id}/pay`, { paid_at: '2027-10-12' })).status,
    ).toBe(400);
  });

  it('atomicidade: falha após liquidar os lançamentos desfaz tudo', async () => {
    const { methodId } = await setup('2027-10-20');
    const a = await buy(methodId, '2027-10-02');
    const failing = prisma.$extends({
      query: {
        invoice: {
          update() {
            throw new Error('falha injetada');
          },
        },
      },
    }) as unknown as PrismaClient;
    const app = createApp({ prisma: failing, clock: env.clock });
    const res = await request(app)
      .post(`/api/invoices/${a.body.invoice.id}/pay`)
      .send({ paid_at: '2027-10-12', payment_method_id: pix });
    expect(res.status).toBe(500);
    const tx = await prisma.transaction.findFirstOrThrow();
    expect(tx.status).toBe('PENDING');
    expect(tx.paidAt).toBeNull();
    expect((await prisma.invoice.findFirstOrThrow()).status).toBe('CLOSED');
  });
});

describe('compra parcelada (T-26)', () => {
  const amountsOf = (body: { installments: { amount: number }[] }) =>
    body.installments.map((i) => i.amount);

  it('CA-PAR-01/02/03: distribuição de centavos', async () => {
    const { methodId } = await setup('2027-10-01');
    const cases: [number, number, number[]][] = [
      [30000, 3, [10000, 10000, 10000]],
      [10000, 3, [3333, 3333, 3334]],
      [1000, 6, [166, 166, 167, 167, 167, 167]],
    ];
    for (const [total, count, expected] of cases) {
      const res = await buy(methodId, '2027-10-05', { amount: total, installment_count: count });
      expect(res.status).toBe(201);
      expect(amountsOf(res.body.installment_plan)).toEqual(expected);
      expect(res.body.installment_plan.total_amount).toBe(total);
    }
  });

  it('CA-PAR-04/06: melhor dia 6, compra 05/10 em 3x → out, nov, dez com vencimentos das faturas', async () => {
    const { methodId } = await setup('2027-10-01');
    const res = await buy(methodId, '2027-10-05', { installment_count: 3, amount: 30000 });
    const parts = res.body.installment_plan.installments as {
      financial_month: string;
      due_date: string;
      number: number;
    }[];
    expect(parts.map((p) => p.financial_month)).toEqual(['2027-10', '2027-11', '2027-12']);
    expect(parts.map((p) => p.due_date)).toEqual(['2027-10-15', '2027-11-15', '2027-12-15']);
    expect(parts.map((p) => p.number)).toEqual([1, 2, 3]);
  });

  it('CA-PAR-05: compra 07/10 em 3x → nov, dez, jan', async () => {
    const { methodId } = await setup('2027-10-10');
    const res = await buy(methodId, '2027-10-07', { installment_count: 3, amount: 30000 });
    const months = (res.body.installment_plan.installments as { financial_month: string }[]).map(
      (p) => p.financial_month,
    );
    expect(months).toEqual(['2027-11', '2027-12', '2028-01']);
  });

  it('melhor dia 25, vencimento 5: 2x de 20/10 → out (vence 05/11) e nov (vence 05/12)', async () => {
    const { methodId } = await setup('2027-10-20', 25, 5);
    const res = await buy(methodId, '2027-10-20', { installment_count: 2, amount: 20000 });
    const parts = res.body.installment_plan.installments as {
      financial_month: string;
      due_date: string;
    }[];
    expect(parts.map((p) => [p.financial_month, p.due_date])).toEqual([
      ['2027-10', '2027-11-05'],
      ['2027-11', '2027-12-05'],
    ]);
  });

  it('primeira parcela segue a regra de compra tardia', async () => {
    const { methodId } = await setup('2027-10-20');
    const first = await buy(methodId, '2027-10-03');
    await payInvoice(first.body.invoice.id, '2027-10-14');
    const res = await buy(methodId, '2027-10-05', { installment_count: 2, amount: 20000 });
    const months = (res.body.installment_plan.installments as { financial_month: string }[]).map(
      (p) => p.financial_month,
    );
    expect(months).toEqual(['2027-11', '2027-12']);
  });

  it('CA-PAR-07: 1 parcela é rejeitada; fora do cartão também; 121 parcelas é inválido', async () => {
    const { methodId } = await setup('2027-10-01');
    expect((await buy(methodId, '2027-10-05', { installment_count: 1 })).body.error.code).toBe(
      'INVALID_INSTALLMENT_OPERATION',
    );
    expect((await buy(methodId, '2027-10-05', { installment_count: 121 })).status).toBe(400);
    const withPix = await api.post('/api/transactions', {
      description: 'X',
      amount: 1000,
      due_date: '2027-10-05',
      category_id: category,
      payment_method_id: pix,
      installment_count: 2,
    });
    expect(withPix.body.error.code).toBe('INVALID_INSTALLMENT_OPERATION');
  });

  it('120 parcelas é aceito (limite técnico)', async () => {
    const { methodId } = await setup('2027-10-01');
    const res = await buy(methodId, '2027-10-05', { installment_count: 120, amount: 120000 });
    expect(res.status).toBe(201);
    expect(res.body.installment_plan.installments).toHaveLength(120);
  });

  it('CA-PAR-12: não existe transação-mãe; GET do plano traz as parcelas', async () => {
    const { methodId } = await setup('2027-10-01');
    const res = await buy(methodId, '2027-10-05', { installment_count: 3, amount: 30000 });
    const list = (await api.get('/api/transactions')).body.data as {
      amount: number;
      origin: string;
      installment: { number: number; installment_count: number };
    }[];
    expect(list).toHaveLength(3);
    expect(list.every((t) => t.origin === 'INSTALLMENT' && t.amount === 10000)).toBe(true);
    expect(list[0]?.installment.installment_count).toBe(3);
    const plan = await api.get(`/api/installment-plans/${res.body.installment_plan.id}`);
    expect(plan.body.installments).toHaveLength(3);
    expect(plan.body.description).toBe('Compra');
  });

  it('CA-PAR-08: valor, quantidade, cartão e data não são editáveis', async () => {
    const { methodId } = await setup('2027-10-01');
    const res = await buy(methodId, '2027-10-05', { installment_count: 2, amount: 20000 });
    const planId = res.body.installment_plan.id as string;
    for (const body of [
      { total_amount: 1 },
      { installment_count: 3 },
      { credit_card_id: methodId },
      { purchase_date: '2027-10-06' },
    ]) {
      expect((await api.put(`/api/installment-plans/${planId}`, body)).status).toBe(400);
    }
    const txId = res.body.installment_plan.installments[0].transaction_id as string;
    const edit = await api.put(`/api/transactions/${txId}`, { amount: 5 });
    expect(edit.body.error.code).toBe('TRANSACTION_NOT_EDITABLE');
  });

  it('parcela não é excluída nem paga individualmente', async () => {
    const { methodId } = await setup('2027-10-20');
    const res = await buy(methodId, '2027-10-05', { installment_count: 2, amount: 20000 });
    const txId = res.body.installment_plan.installments[0].transaction_id as string;
    expect((await api.delete(`/api/transactions/${txId}`)).body.error.code).toBe(
      'TRANSACTION_NOT_DELETABLE',
    );
    expect(
      (await api.post(`/api/transactions/${txId}/pay`, { paid_at: '2027-10-10' })).body.error.code,
    ).toBe('CARD_TRANSACTION_SETTLED_BY_INVOICE');
  });

  it('CA-PAR-09: descrição e categoria valem para todas as parcelas', async () => {
    const { methodId } = await setup('2027-10-01');
    const res = await buy(methodId, '2027-10-05', { installment_count: 3, amount: 30000 });
    const planId = res.body.installment_plan.id as string;
    const other = await api.category('Eletrônicos', 'EXPENSE');
    const updated = await api.put(`/api/installment-plans/${planId}`, {
      description: 'Notebook',
      category_id: other,
    });
    expect(updated.status).toBe(200);
    expect(updated.body).toMatchObject({ description: 'Notebook' });
    expect(updated.body.category.id).toBe(other);
    const txs = (await api.get('/api/transactions')).body.data as {
      description: string;
      category: { id: string };
    }[];
    expect(txs.every((t) => t.description === 'Notebook' && t.category.id === other)).toBe(true);
    // categoria de outro tipo
    const income = await api.category('Renda', 'INCOME');
    expect(
      (await api.put(`/api/installment-plans/${planId}`, { category_id: income })).body.error.code,
    ).toBe('CATEGORY_TYPE_MISMATCH');
  });

  it('CA-PAR-09: parcela em fatura PAID ou em mês fechado bloqueia a edição do plano inteiro', async () => {
    const { methodId } = await setup('2027-10-20');
    const res = await buy(methodId, '2027-10-05', { installment_count: 3, amount: 30000 });
    const planId = res.body.installment_plan.id as string;
    // mês da última parcela fechado
    await prisma.financialPeriod.create({
      data: { referenceMonth: '2027-12', status: 'CLOSED', closedAt: new Date() },
    });
    const closedParcel = await api.put(`/api/installment-plans/${planId}`, { description: 'X' });
    expect(closedParcel.status).toBe(422);
    expect(closedParcel.body.error.code).toBe('INVALID_INSTALLMENT_OPERATION');
    await prisma.financialPeriod.deleteMany();
    // primeira fatura paga
    const invoiceId = res.body.installment_plan.installments[0].invoice.id as string;
    await payInvoice(invoiceId, '2027-10-14');
    const paid = await api.put(`/api/installment-plans/${planId}`, { description: 'Y' });
    expect(paid.status).toBe(409);
    expect(paid.body.error.code).toBe('INVOICE_ALREADY_PAID');
    const txs = (await api.get('/api/transactions')).body.data as { description: string }[];
    expect(txs.every((t) => t.description === 'Compra')).toBe(true);
  });

  it('CA-PAR-10: pagar a fatura de outubro liquida somente a parcela 1/3', async () => {
    const { methodId } = await setup('2027-10-20');
    const res = await buy(methodId, '2027-10-05', { installment_count: 3, amount: 30000 });
    await payInvoice(res.body.installment_plan.installments[0].invoice.id, '2027-10-14');
    const plan = await api.get(`/api/installment-plans/${res.body.installment_plan.id}`);
    expect((plan.body.installments as { status: string }[]).map((p) => p.status)).toEqual([
      'PAID',
      'PENDING',
      'PENDING',
    ]);
  });

  it('criação atômica: se uma parcela falha, nada é criado', async () => {
    const { methodId } = await setup('2027-10-20');
    await prisma.financialPeriod.create({
      data: { referenceMonth: '2027-12', status: 'CLOSED', closedAt: new Date() },
    });
    const res = await buy(methodId, '2027-10-05', { installment_count: 3, amount: 30000 });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('PERIOD_CLOSED');
    expect(await prisma.installmentPlan.count()).toBe(0);
    expect(await prisma.transaction.count()).toBe(0);
    expect(await prisma.installment.count()).toBe(0);
    expect(await prisma.invoice.count()).toBe(0);
  });
});
