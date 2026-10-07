import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { Api, prisma, setupEnv, type TestEnv } from './helpers.js';
import { parseLocalDate } from '../../src/shared/dates.js';

let env: TestEnv;
let api: Api;
let expense: string;
let income: string;
let pix: string;

const manual = (overrides: Record<string, unknown> = {}) => ({
  description: 'Aluguel',
  amount: 150000,
  due_date: '2027-09-15',
  category_id: expense,
  payment_method_id: pix,
  ...overrides,
});

const closeMonth = (month: string) =>
  prisma.financialPeriod.create({
    data: { userId: env.userId, referenceMonth: month, status: 'CLOSED', closedAt: new Date() },
  });

beforeEach(async () => {
  env = await setupEnv('2027-09-30');
  api = new Api(env);
  expense = await api.category('Moradia', 'EXPENSE');
  income = await api.category('Salário', 'INCOME');
  pix = await api.systemMethod('PIX');
});
afterAll(() => prisma.$disconnect());

describe('lançamentos manuais — criação (T-21)', () => {
  it('CA-TRA-01: saída com categoria EXPENSE e método válido', async () => {
    const res = await api.post('/api/transactions', manual());
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      description: 'Aluguel',
      amount: 150000,
      type: 'EXPENSE',
      status: 'PENDING',
      origin: 'MANUAL',
      financial_month: '2027-09',
      due_date: '2027-09-15',
      paid_at: null,
    });
  });

  it('CA-TRA-02: entrada com categoria INCOME', async () => {
    const res = await api.post(
      '/api/transactions',
      manual({ category_id: income, type: 'INCOME' }),
    );
    expect(res.status).toBe(201);
    expect(res.body.type).toBe('INCOME');
  });

  it('CA-TRA-03: entrada com categoria EXPENSE é rejeitada', async () => {
    const res = await api.post('/api/transactions', manual({ type: 'INCOME' }));
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('CATEGORY_TYPE_MISMATCH');
  });

  it('CA-TRA-04: sem método é rejeitado', async () => {
    const body: Record<string, unknown> = manual();
    delete body.payment_method_id;
    expect((await api.post('/api/transactions', body)).status).toBe(400);
  });

  it('CA-TRA-05: valor zero ou negativo é rejeitado', async () => {
    for (const amount of [0, -100, 10.5]) {
      expect((await api.post('/api/transactions', manual({ amount }))).status).toBe(400);
    }
  });

  it('descrição obrigatória até 200 caracteres', async () => {
    expect((await api.post('/api/transactions', manual({ description: '  ' }))).status).toBe(400);
    expect(
      (await api.post('/api/transactions', manual({ description: 'a'.repeat(201) }))).status,
    ).toBe(400);
  });

  it('categoria ou método inativos são rejeitados', async () => {
    await api.post(`/api/categories/${expense}/deactivate`);
    const cat = await api.post('/api/transactions', manual());
    expect(cat.body.error.code).toBe('CATEGORY_INACTIVE');
    await api.post(`/api/categories/${expense}/activate`);
    await api.post(`/api/payment-methods/${pix}/deactivate`);
    const met = await api.post('/api/transactions', manual());
    expect(met.body.error.code).toBe('PAYMENT_METHOD_INACTIVE');
  });

  it('CA-TRA-10: retroativo só no mês corrente (hoje 30/09)', async () => {
    for (const due of ['2027-09-01', '2027-09-15', '2027-09-30', '2027-10-20', '2028-03-10']) {
      expect((await api.post('/api/transactions', manual({ due_date: due }))).status).toBe(201);
    }
    const res = await api.post('/api/transactions', manual({ due_date: '2027-08-31' }));
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('INVALID_DUE_DATE');
  });

  it('criação em mês fechado é rejeitada', async () => {
    await closeMonth('2027-10');
    const res = await api.post('/api/transactions', manual({ due_date: '2027-10-05' }));
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('PERIOD_CLOSED');
  });

  it('1x explícito é rejeitado; parcelamento exige cartão', async () => {
    const res = await api.post('/api/transactions', manual({ installment_count: 3 }));
    expect(res.body.error.code).toBe('INVALID_INSTALLMENT_OPERATION');
  });
});

describe('lançamentos manuais — status, pagamento e exclusão (T-21)', () => {
  it('CA-TRA-06/07: pagar antecipado mantém o mês financeiro', async () => {
    const created = await api.post('/api/transactions', manual());
    const res = await api.post(`/api/transactions/${created.body.id}/pay`, {
      paid_at: '2027-09-08',
    });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      status: 'PAID',
      paid_at: '2027-09-08',
      financial_month: '2027-09',
    });
  });

  it('vencimento 02/10 pago em 29/09 continua em outubro', async () => {
    const created = await api.post('/api/transactions', manual({ due_date: '2027-10-02' }));
    const res = await api.post(`/api/transactions/${created.body.id}/pay`, {
      paid_at: '2027-09-29',
    });
    expect(res.body.financial_month).toBe('2027-10');
  });

  it('CA-TRA-08: PAID → PENDING remove paid_at', async () => {
    const created = await api.post('/api/transactions', manual());
    await api.post(`/api/transactions/${created.body.id}/pay`, { paid_at: '2027-09-08' });
    const res = await api.post(`/api/transactions/${created.body.id}/unpay`);
    expect(res.body).toMatchObject({ status: 'PENDING', paid_at: null });
  });

  it('CA-TRA-18: paid_at futuro ou em mês fechado é rejeitado', async () => {
    const created = await api.post('/api/transactions', manual());
    const future = await api.post(`/api/transactions/${created.body.id}/pay`, {
      paid_at: '2027-10-01',
    });
    expect(future.status).toBe(422);
    expect(future.body.error.code).toBe('INVALID_PAYMENT_DATE');
    await closeMonth('2027-08');
    const closedMonth = await api.post(`/api/transactions/${created.body.id}/pay`, {
      paid_at: '2027-08-10',
    });
    expect(closedMonth.body.error.code).toBe('INVALID_PAYMENT_DATE');
  });

  it('pagar sem paid_at é rejeitado', async () => {
    const created = await api.post('/api/transactions', manual());
    expect((await api.post(`/api/transactions/${created.body.id}/pay`, {})).status).toBe(400);
  });

  it('CA-TRA-14: exclui MANUAL fisicamente em mês aberto', async () => {
    const created = await api.post('/api/transactions', manual());
    expect((await api.delete(`/api/transactions/${created.body.id}`)).status).toBe(204);
    expect((await api.get(`/api/transactions/${created.body.id}`)).status).toBe(404);
  });

  it('mês fechado: bloqueia pagar, desfazer, editar e excluir', async () => {
    const created = await api.post('/api/transactions', manual());
    const id = created.body.id as string;
    await api.post(`/api/transactions/${id}/pay`, { paid_at: '2027-09-10' });
    await closeMonth('2027-09');
    const results = await Promise.all([
      api.post(`/api/transactions/${id}/unpay`),
      api.put(`/api/transactions/${id}`, { description: 'Novo' }),
      api.delete(`/api/transactions/${id}`),
    ]);
    for (const res of results) {
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('PERIOD_CLOSED');
    }
    const pending = await api.post('/api/transactions', manual({ due_date: '2027-10-05' }));
    await closeMonth('2027-10');
    expect(
      (await api.post(`/api/transactions/${pending.body.id}/pay`, { paid_at: '2027-09-30' })).body
        .error.code,
    ).toBe('PERIOD_CLOSED');
  });
});

describe('lançamentos manuais — edição (T-21, T-14)', () => {
  it('edita descrição, valor, categoria (mesmo tipo) e método comum', async () => {
    const created = await api.post('/api/transactions', manual());
    const other = await api.category('Contas', 'EXPENSE');
    const dinheiro = await api.systemMethod('Dinheiro');
    const res = await api.put(`/api/transactions/${created.body.id}`, {
      description: 'Aluguel setembro',
      amount: 160000,
      category_id: other,
      payment_method_id: dinheiro,
    });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ description: 'Aluguel setembro', amount: 160000 });
    expect(res.body.category.id).toBe(other);
    expect(res.body.payment_method.id).toBe(dinheiro);
  });

  it('categoria de outro tipo é rejeitada', async () => {
    const created = await api.post('/api/transactions', manual());
    const res = await api.put(`/api/transactions/${created.body.id}`, { category_id: income });
    expect(res.body.error.code).toBe('CATEGORY_TYPE_MISMATCH');
  });

  it('CA-TRA-11: mover vencimento dentro do mês e para outro mês aberto', async () => {
    const created = await api.post('/api/transactions', manual());
    const id = created.body.id as string;
    for (const due of ['2027-09-10', '2027-09-20']) {
      const res = await api.put(`/api/transactions/${id}`, { due_date: due });
      expect(res.body).toMatchObject({ due_date: due, financial_month: '2027-09' });
    }
    const moved = await api.put(`/api/transactions/${id}`, { due_date: '2027-10-05' });
    expect(moved.body).toMatchObject({ due_date: '2027-10-05', financial_month: '2027-10' });
  });

  it('CA-TRA-12: mover para mês fechado (ou a partir de um) é rejeitado', async () => {
    const created = await api.post('/api/transactions', manual());
    await closeMonth('2027-08');
    const res = await api.put(`/api/transactions/${created.body.id}`, { due_date: '2027-08-31' });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('PERIOD_CLOSED');
  });

  it('CA-TRA-13/CA-CAT-12/CA-MET-12: em mês fechado, categoria e método não mudam', async () => {
    const created = await api.post('/api/transactions', manual());
    const other = await api.category('Outra', 'EXPENSE');
    const dinheiro = await api.systemMethod('Dinheiro');
    await closeMonth('2027-09');
    for (const body of [{ category_id: other }, { payment_method_id: dinheiro }, { amount: 1 }]) {
      const res = await api.put(`/api/transactions/${created.body.id}`, body);
      expect(res.body.error.code).toBe('PERIOD_CLOSED');
    }
  });

  it('CA-TRA-17: trocar PIX por cartão é rejeitado', async () => {
    const created = await api.post('/api/transactions', manual());
    const { methodId } = await api.card('Nubank');
    const res = await api.put(`/api/transactions/${created.body.id}`, {
      payment_method_id: methodId,
    });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('TRANSACTION_NOT_EDITABLE');
  });

  it('método desativado depois não obriga trocar na edição', async () => {
    const created = await api.post('/api/transactions', manual());
    await api.post(`/api/payment-methods/${pix}/deactivate`);
    const res = await api.put(`/api/transactions/${created.body.id}`, { description: 'Ajustado' });
    expect(res.status).toBe(200);
    expect(res.body.payment_method.id).toBe(pix);
  });

  it('purchase_date não existe em lançamento manual', async () => {
    const created = await api.post('/api/transactions', manual());
    const res = await api.put(`/api/transactions/${created.body.id}`, {
      purchase_date: '2027-09-01',
    });
    expect(res.body.error.code).toBe('TRANSACTION_NOT_EDITABLE');
  });
});

describe('listagem (T-21)', () => {
  it('filtra por mês financeiro, status e origem', async () => {
    await api.post('/api/transactions', manual());
    const b = await api.post('/api/transactions', manual({ due_date: '2027-10-05' }));
    await api.post(`/api/transactions/${b.body.id}/pay`, { paid_at: '2027-09-30' });
    expect((await api.get('/api/transactions')).body.data).toHaveLength(2);
    expect((await api.get('/api/transactions?month=2027-10')).body.data).toHaveLength(1);
    expect((await api.get('/api/transactions?status=PAID')).body.data).toHaveLength(1);
    expect((await api.get('/api/transactions?origin=CREDIT_CARD')).body.data).toHaveLength(0);
    expect((await api.get('/api/transactions?month=2027-13')).status).toBe(400);
  });
});

describe('relógio', () => {
  it('FixedClock é usado como "hoje"', async () => {
    env.clock.set(parseLocalDate('2027-11-15'));
    const res = await api.post('/api/transactions', manual({ due_date: '2027-10-31' }));
    expect(res.body.error.code).toBe('INVALID_DUE_DATE');
  });
});
