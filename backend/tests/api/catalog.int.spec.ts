import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { Api, prisma, setupEnv } from './helpers.js';
import { seedSystemMethods } from '../../src/shared/seed.js';

let api: Api;

beforeEach(async () => {
  api = new Api(await setupEnv());
});
afterAll(() => prisma.$disconnect());

describe('seed dos métodos do sistema (T-16, CA-MET-01)', () => {
  it('cria PIX, Dinheiro e Débito como SYSTEM/STANDARD/ativos', async () => {
    const res = await api.get('/api/payment-methods');
    const methods = res.body.data as {
      name: string;
      source: string;
      kind: string;
      active: boolean;
    }[];
    expect(methods.map((m) => m.name).sort()).toEqual(['Dinheiro', 'Débito', 'PIX']);
    for (const m of methods) {
      expect(m).toMatchObject({ source: 'SYSTEM', kind: 'STANDARD', active: true });
    }
  });

  it('é idempotente', async () => {
    await seedSystemMethods(prisma);
    await seedSystemMethods(prisma);
    expect(await prisma.paymentMethod.count()).toBe(3);
  });
});

describe('categorias (T-17)', () => {
  it('CA-CAT-01: cria ativa com nome e tipo válidos', async () => {
    const res = await api.post('/api/categories', { name: '  Alimentação ', type: 'EXPENSE' });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ name: 'Alimentação', type: 'EXPENSE', active: true });
  });

  it('CA-CAT-02: tipo inválido é rejeitado', async () => {
    const res = await api.post('/api/categories', { name: 'X', type: 'NEUTRAL' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('CA-CAT-03: nome vazio ou acima do limite é rejeitado', async () => {
    expect((await api.post('/api/categories', { name: '   ', type: 'INCOME' })).status).toBe(400);
    expect(
      (await api.post('/api/categories', { name: 'a'.repeat(101), type: 'INCOME' })).status,
    ).toBe(400);
    expect(
      (await api.post('/api/categories', { name: 'a'.repeat(100), type: 'INCOME' })).status,
    ).toBe(201);
  });

  it('CA-CAT-04: nome duplicado sem diferenciar maiúsculas, entre ativas e inativas', async () => {
    const id = await api.category('Alimentação');
    const dup = await api.post('/api/categories', { name: 'alimentação', type: 'EXPENSE' });
    expect(dup.status).toBe(409);
    expect(dup.body.error.code).toBe('CATEGORY_NAME_TAKEN');
    await api.post(`/api/categories/${id}/deactivate`);
    const dupInactive = await api.post('/api/categories', { name: 'ALIMENTAÇÃO', type: 'EXPENSE' });
    expect(dupInactive.body.error.code).toBe('CATEGORY_NAME_TAKEN');
  });

  it('CA-CAT-05: renomear preserva o identificador', async () => {
    const id = await api.category('Mercado');
    const res = await api.put(`/api/categories/${id}`, { name: 'Supermercado' });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id, name: 'Supermercado' });
    // pode "renomear" para o mesmo nome em outra caixa
    expect((await api.put(`/api/categories/${id}`, { name: 'SUPERMERCADO' })).status).toBe(200);
  });

  it('CA-CAT-06/07: desativar e reativar', async () => {
    const id = await api.category('Lazer');
    const off = await api.post(`/api/categories/${id}/deactivate`);
    expect(off.body.active).toBe(false);
    const on = await api.post(`/api/categories/${id}/activate`);
    expect(on.body).toMatchObject({ id, active: true, name: 'Lazer', type: 'EXPENSE' });
  });

  it('CA-CAT-08: não existe exclusão', async () => {
    const id = await api.category('Lazer');
    expect((await api.delete(`/api/categories/${id}`)).status).toBe(404);
  });

  it('CA-CAT-10: tipo de categoria sem uso pode mudar', async () => {
    const id = await api.category('Outros', 'EXPENSE');
    const res = await api.put(`/api/categories/${id}`, { type: 'INCOME' });
    expect(res.status).toBe(200);
    expect(res.body.type).toBe('INCOME');
  });

  it('CA-CAT-11: tipo bloqueado com uso em lançamento', async () => {
    const id = await api.category('Mercado', 'EXPENSE');
    const pix = await api.systemMethod('PIX');
    const created = await api.post('/api/transactions', {
      description: 'Compra',
      amount: 1000,
      due_date: '2027-10-05',
      category_id: id,
      payment_method_id: pix,
    });
    expect(created.status).toBe(201);
    const res = await api.put(`/api/categories/${id}`, { type: 'INCOME' });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('CATEGORY_TYPE_LOCKED');
    // renomear continua permitido; mesmo tipo é aceito
    expect(
      (await api.put(`/api/categories/${id}`, { name: 'Mercado 2', type: 'EXPENSE' })).status,
    ).toBe(200);
  });

  it('CA-CAT-11: tipo bloqueado com uso em recorrência', async () => {
    const id = await api.category('Luz', 'EXPENSE');
    const pix = await api.systemMethod('PIX');
    const rec = await api.post('/api/recurrences', {
      description: 'Luz',
      amount: 20000,
      category_id: id,
      payment_method_id: pix,
      due_day: 20,
      start_date: '2027-10-01',
    });
    expect(rec.status).toBe(201);
    const res = await api.put(`/api/categories/${id}`, { type: 'INCOME' });
    expect(res.body.error.code).toBe('CATEGORY_TYPE_LOCKED');
    const list = await api.get('/api/categories');
    expect(list.body.data[0].in_use).toBe(true);
  });

  it('categoria inexistente → 404', async () => {
    const res = await api.put('/api/categories/6f1c3c4e-0000-4000-8000-000000000000', {
      name: 'X',
    });
    expect(res.status).toBe(404);
  });
});

describe('métodos de pagamento (T-18)', () => {
  it('CA-MET-02: cria ativo, USER, STANDARD', async () => {
    const res = await api.post('/api/payment-methods', { name: 'Vale-refeição' });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ source: 'USER', kind: 'STANDARD', active: true });
  });

  it('CA-MET-10: o fluxo genérico não cria cartão nem aceita source', async () => {
    const asCard = await api.post('/api/payment-methods', { name: 'Crédito', kind: 'CREDIT_CARD' });
    expect(asCard.status).toBe(400);
    const asSystem = await api.post('/api/payment-methods', { name: 'Y', source: 'SYSTEM' });
    expect(asSystem.status).toBe(400);
    expect(await prisma.paymentMethod.count({ where: { kind: 'CREDIT_CARD' } })).toBe(0);
  });

  it('CA-MET-03: editar nome preserva o identificador', async () => {
    const id = await api.method('Vale');
    const res = await api.put(`/api/payment-methods/${id}`, { name: 'Vale-transporte' });
    expect(res.body).toMatchObject({ id, name: 'Vale-transporte' });
  });

  it('CA-MET-04: editar método do sistema é rejeitado', async () => {
    const pix = await api.systemMethod('PIX');
    const res = await api.put(`/api/payment-methods/${pix}`, { name: 'Pix 2' });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('PAYMENT_METHOD_NOT_EDITABLE');
  });

  it('nome de cartão é editado pelo fluxo de cartão', async () => {
    const { methodId } = await api.card('Nubank');
    const res = await api.put(`/api/payment-methods/${methodId}`, { name: 'Outro' });
    expect(res.body.error.code).toBe('PAYMENT_METHOD_NOT_EDITABLE');
  });

  it('CA-MET-05/06: desativar e reativar, inclusive método do sistema', async () => {
    const pix = await api.systemMethod('PIX');
    expect((await api.post(`/api/payment-methods/${pix}/deactivate`)).body.active).toBe(false);
    expect((await api.post(`/api/payment-methods/${pix}/activate`)).body.active).toBe(true);
  });

  it('CA-MET-07: não existe exclusão', async () => {
    const id = await api.method('Vale');
    expect((await api.delete(`/api/payment-methods/${id}`)).status).toBe(404);
  });

  it('nome único sem diferenciar maiúsculas, inclusive contra métodos do sistema (CA-MET-11)', async () => {
    const dup = await api.post('/api/payment-methods', { name: 'pix' });
    expect(dup.status).toBe(409);
    expect(dup.body.error.code).toBe('PAYMENT_METHOD_NAME_TAKEN');
    await api.card('Nubank');
    const dupCard = await api.post('/api/payment-methods', { name: 'NUBANK' });
    expect(dupCard.body.error.code).toBe('PAYMENT_METHOD_NAME_TAKEN');
  });
});

describe('cartões (T-19)', () => {
  it('CA-CAR-01: cria PaymentMethod CREDIT_CARD e CreditCard', async () => {
    const res = await api.post('/api/credit-cards', {
      name: 'Nubank',
      best_purchase_day: 6,
      due_day: 15,
    });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      name: 'Nubank',
      active: true,
      best_purchase_day: 6,
      due_day: 15,
    });
    const method = await prisma.paymentMethod.findUnique({
      where: { id: res.body.payment_method_id },
    });
    expect(method).toMatchObject({ kind: 'CREDIT_CARD', source: 'USER', active: true });
    expect((await api.get(`/api/credit-cards/${res.body.id}`)).body.id).toBe(res.body.id);
    expect((await api.get('/api/credit-cards')).body.data).toHaveLength(1);
  });

  it('valida dias de 1 a 31', async () => {
    for (const bad of [0, 32, 1.5]) {
      const res = await api.post('/api/credit-cards', {
        name: 'X',
        best_purchase_day: bad,
        due_day: 10,
      });
      expect(res.status).toBe(400);
    }
    expect(
      (await api.post('/api/credit-cards', { name: 'X', best_purchase_day: 31, due_day: 1 }))
        .status,
    ).toBe(201);
  });

  it('criação é atômica: falha no segundo insert não deixa método órfão', async () => {
    const { createCreditCard } =
      await import('../../src/modules/credit-cards/credit-cards.service.js');
    const ctx = { prisma, clock: (await setupEnv()).clock };
    await expect(
      createCreditCard(ctx, { name: 'Quebrado', bestPurchaseDay: 40, dueDay: 10 }),
    ).rejects.toThrow();
    expect(await prisma.paymentMethod.count({ where: { name: 'Quebrado' } })).toBe(0);
  });

  it('nome único entre todos os métodos', async () => {
    await api.method('Vale');
    const dup = await api.post('/api/credit-cards', {
      name: 'vale',
      best_purchase_day: 1,
      due_day: 2,
    });
    expect(dup.status).toBe(409);
    expect(dup.body.error.code).toBe('PAYMENT_METHOD_NAME_TAKEN');
  });

  it('edita nome e configuração', async () => {
    const { cardId, methodId } = await api.card('Nubank');
    const res = await api.put(`/api/credit-cards/${cardId}`, {
      name: 'Nubank Ultravioleta',
      best_purchase_day: 10,
      due_day: 20,
    });
    expect(res.body).toMatchObject({
      name: 'Nubank Ultravioleta',
      best_purchase_day: 10,
      due_day: 20,
    });
    expect((await prisma.paymentMethod.findUnique({ where: { id: methodId } }))?.name).toBe(
      'Nubank Ultravioleta',
    );
  });

  it('desativa e reativa pelo PaymentMethod', async () => {
    const { cardId, methodId } = await api.card('Nubank');
    expect((await api.post(`/api/credit-cards/${cardId}/deactivate`)).body.active).toBe(false);
    expect((await prisma.paymentMethod.findUnique({ where: { id: methodId } }))?.active).toBe(
      false,
    );
    expect((await api.post(`/api/credit-cards/${cardId}/activate`)).body.active).toBe(true);
  });
});

describe('meses financeiros (T-20)', () => {
  it('mês sem registro é OPEN', async () => {
    const res = await api.get('/api/financial-periods/2030-05');
    expect(res.body).toEqual({ reference_month: '2030-05', status: 'OPEN', closed_at: null });
    expect(await prisma.financialPeriod.count()).toBe(0);
  });

  it('mês persistido aberto e fechado', async () => {
    await prisma.financialPeriod.create({ data: { referenceMonth: '2027-08', status: 'OPEN' } });
    await prisma.financialPeriod.create({
      data: {
        referenceMonth: '2027-09',
        status: 'CLOSED',
        closedAt: new Date('2027-10-01T12:00:00Z'),
      },
    });
    expect((await api.get('/api/financial-periods/2027-08')).body.status).toBe('OPEN');
    const closed = await api.get('/api/financial-periods/2027-09');
    expect(closed.body.status).toBe('CLOSED');
    expect(closed.body.closed_at).toBe('2027-10-01T12:00:00.000Z');
  });

  it('mês inválido → 400', async () => {
    expect((await api.get('/api/financial-periods/2027-13')).status).toBe(400);
  });
});
