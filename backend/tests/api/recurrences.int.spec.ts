import { afterAll, beforeEach, describe, expect, it } from 'vitest';
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
  expense = await api.category('Contas', 'EXPENSE');
  income = await api.category('Renda', 'INCOME');
  pix = await api.systemMethod('PIX');
};

const goto = (date: string) => env.clock.set(parseLocalDate(date));

const createRec = (overrides: Record<string, unknown> = {}) =>
  api.post('/api/recurrences', {
    description: 'Aluguel',
    amount: 150000,
    category_id: expense,
    payment_method_id: pix,
    due_day: 8,
    start_date: '2027-01-01',
    ...overrides,
  });

const statement = async (month: string) =>
  (await api.get(`/api/monthly-statement?month=${month}`)).body;
const recTransactions = async () =>
  (
    (await api.get('/api/transactions?origin=RECURRENCE')).body.data as {
      id: string;
      amount: number;
      due_date: string;
      financial_month: string;
      occurrence_month: string;
      status: string;
      purchase_date: string | null;
      invoice: { due_date: string; id: string } | null;
    }[]
  ).sort((a, b) => a.occurrence_month.localeCompare(b.occurrence_month));
const projected = async (month: string) =>
  (
    (await statement(month)).items as {
      item_type: string;
      amount: number;
      display_date: string;
      description: string;
    }[]
  ).filter((i) => i.item_type === 'PROJECTED_OCCURRENCE');

describe('cadastro de recorrências (T-28)', () => {
  beforeEach(() => setup('2027-09-20'));

  it('CA-REC-01: cria com e sem end_date', async () => {
    const open = await createRec();
    expect(open.status).toBe(201);
    expect(open.body).toMatchObject({
      status: 'ACTIVE',
      due_day: 8,
      end_date: null,
      cancelled_at: null,
      type: 'EXPENSE',
    });
    const closed = await createRec({ description: 'Curso', end_date: '2027-12-31' });
    expect(closed.body.end_date).toBe('2027-12-31');
    expect((await api.get('/api/recurrences')).body.data).toHaveLength(2);
    expect((await api.get(`/api/recurrences/${open.body.id}`)).body.id).toBe(open.body.id);
  });

  it('CA-REC-17: recorrência de entrada', async () => {
    const res = await createRec({ category_id: income, description: 'Salário', due_day: 5 });
    expect(res.body.type).toBe('INCOME');
  });

  it('validações de formato', async () => {
    for (const bad of [
      { description: '  ' },
      { amount: 0 },
      { amount: 10.5 },
      { due_day: 0 },
      { due_day: 32 },
      { start_date: '2027-02-30' },
      { frequency: 'WEEKLY' },
    ]) {
      expect((await createRec(bad)).status).toBe(400);
    }
    expect((await createRec({ due_day: 31 })).status).toBe(201);
  });

  it('categoria, método ou cartão inativos são rejeitados', async () => {
    await api.post(`/api/categories/${expense}/deactivate`);
    expect((await createRec()).body.error.code).toBe('CATEGORY_INACTIVE');
    await api.post(`/api/categories/${expense}/activate`);
    await api.post(`/api/payment-methods/${pix}/deactivate`);
    expect((await createRec()).body.error.code).toBe('PAYMENT_METHOD_INACTIVE');
    await api.post(`/api/payment-methods/${pix}/activate`);
    const card = await api.card('Nubank');
    await api.post(`/api/credit-cards/${card.cardId}/deactivate`);
    expect((await createRec({ payment_method_id: card.methodId })).body.error.code).toBe(
      'CARD_INACTIVE',
    );
  });

  it('edita descrição, valor, dia, categoria, método e end_date; null remove o término', async () => {
    const rec = await createRec({ end_date: '2027-12-31' });
    const other = await api.category('Outra', 'EXPENSE');
    const dinheiro = await api.systemMethod('Dinheiro');
    const res = await api.put(`/api/recurrences/${rec.body.id}`, {
      description: 'Aluguel novo',
      amount: 160000,
      due_day: 10,
      category_id: other,
      payment_method_id: dinheiro,
      end_date: null,
    });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      description: 'Aluguel novo',
      amount: 160000,
      due_day: 10,
      end_date: null,
    });
    expect(res.body.category.id).toBe(other);
    expect(res.body.payment_method.id).toBe(dinheiro);
    await api.post(`/api/categories/${other}/deactivate`);
    expect(
      (await api.put(`/api/recurrences/${rec.body.id}`, { category_id: expense })).status,
    ).toBe(200);
    const inactive = await api.put(`/api/recurrences/${rec.body.id}`, { category_id: other });
    expect(inactive.body.error.code).toBe('CATEGORY_INACTIVE');
  });

  it('não existe exclusão de recorrência', async () => {
    const rec = await createRec();
    expect((await api.delete(`/api/recurrences/${rec.body.id}`)).status).toBe(404);
  });
});

describe('projeção e geração (T-29, T-30)', () => {
  beforeEach(() => setup('2027-09-20'));

  it('CA-REC-02: criada em 20/09 com dia 10 — sem setembro; primeira ocorrência em 10/10', async () => {
    await createRec({ due_day: 10 });
    expect(await recTransactions()).toHaveLength(0);
    expect(await projected('2027-09')).toHaveLength(0);
    const oct = await projected('2027-10');
    expect(oct).toHaveLength(1);
    expect(oct[0]).toMatchObject({ display_date: '2027-10-10', amount: 150000 });

    goto('2027-10-10');
    const txs = await recTransactions();
    expect(txs).toHaveLength(1);
    expect(txs[0]).toMatchObject({
      due_date: '2027-10-10',
      financial_month: '2027-10',
      occurrence_month: '2027-10',
      status: 'PENDING',
    });
    expect(await projected('2027-10')).toHaveLength(0); // já gerada
    expect(await projected('2027-11')).toHaveLength(1);
  });

  it('CA-REC-04: mês distante é projetado sem persistir os meses intermediários', async () => {
    await createRec();
    const far = await projected('2030-05');
    expect(far).toHaveLength(1);
    expect(far[0]?.display_date).toBe('2030-05-08');
    expect(await prisma.transaction.count()).toBe(0);
  });

  it('CA-REC-03: dia 31 cai no último dia (28/02 e 29/02 bissexto)', async () => {
    await createRec({ due_day: 31 });
    expect((await projected('2028-02'))[0]?.display_date).toBe('2028-02-29');
    expect((await projected('2027-11'))[0]?.display_date).toBe('2027-11-30');
    expect((await projected('2028-03'))[0]?.display_date).toBe('2028-03-31');
  });

  it('respeita start_date e end_date', async () => {
    await createRec({ start_date: '2027-11-09', end_date: '2028-01-31' });
    expect(await projected('2027-10')).toHaveLength(0);
    expect(await projected('2027-11')).toHaveLength(0); // 08/11 < start_date (09/11)
    expect(await projected('2027-12')).toHaveLength(1);
    expect(await projected('2028-01')).toHaveLength(1);
    expect(await projected('2028-02')).toHaveLength(0);
  });

  it('CA-REC-05: alterar o valor antes da data muda o mês corrente e os seguintes', async () => {
    await setup('2027-01-01');
    const rec = await createRec();
    goto('2027-03-05');
    expect((await recTransactions()).map((t) => [t.occurrence_month, t.amount])).toEqual([
      ['2027-01', 150000],
      ['2027-02', 150000],
    ]);
    expect((await projected('2027-03'))[0]?.amount).toBe(150000);
    await api.put(`/api/recurrences/${rec.body.id}`, { amount: 160000 });
    expect((await projected('2027-03'))[0]?.amount).toBe(160000);
    expect((await projected('2027-04'))[0]?.amount).toBe(160000);
    // geradas não mudam (CA-REC-06)
    expect((await recTransactions()).map((t) => t.amount)).toEqual([150000, 150000]);
  });

  it('CA-REC-05/06: alterar depois da data só vale a partir do mês seguinte', async () => {
    await setup('2027-01-01');
    const rec = await createRec();
    goto('2027-03-10');
    await api.put(`/api/recurrences/${rec.body.id}`, { amount: 160000 });
    expect((await recTransactions()).map((t) => t.amount)).toEqual([150000, 150000, 150000]);
    expect((await projected('2027-04'))[0]?.amount).toBe(160000);
  });

  it('geração é idempotente: várias chamadas e reinício não duplicam', async () => {
    await createRec({ due_day: 10 });
    goto('2027-10-10');
    for (let i = 0; i < 3; i += 1) await api.get('/api/transactions');
    const { generateDueOccurrences } = await import('../../src/modules/recurrences/occurrences.js');
    const ctx = { prisma, clock: env.clock };
    await Promise.all([
      generateDueOccurrences(ctx, { fromToday: true }),
      generateDueOccurrences(ctx, { fromToday: true }),
      generateDueOccurrences(ctx),
    ]);
    expect(await recTransactions()).toHaveLength(1);
  });

  it('recuperação: dias sem acesso são gerados quando o sistema volta', async () => {
    await createRec({ due_day: 10 });
    goto('2027-12-20');
    expect((await recTransactions()).map((t) => t.occurrence_month)).toEqual([
      '2027-10',
      '2027-11',
      '2027-12',
    ]);
  });

  it('CA-CAT-13/CA-MET-13: categoria ou método inativos não projetam nem geram; reativar não é retroativo', async () => {
    await createRec({ due_day: 10 });
    await api.post(`/api/categories/${expense}/deactivate`);
    expect(await projected('2027-11')).toHaveLength(0);
    goto('2027-10-10');
    expect(await recTransactions()).toHaveLength(0);
    goto('2027-10-12');
    await api.post(`/api/categories/${expense}/activate`);
    expect(await recTransactions()).toHaveLength(0); // outubro não volta
    expect(await projected('2027-11')).toHaveLength(1);

    await api.post(`/api/payment-methods/${pix}/deactivate`);
    expect(await projected('2027-11')).toHaveLength(0);
    goto('2027-11-11');
    expect(await recTransactions()).toHaveLength(0);
    await api.post(`/api/payment-methods/${pix}/activate`);
    goto('2027-12-10');
    expect((await recTransactions()).map((t) => t.occurrence_month)).toEqual(['2027-12']);
  });

  it('reativar no próprio dia da ocorrência a gera', async () => {
    await createRec({ due_day: 10 });
    await api.post(`/api/payment-methods/${pix}/deactivate`);
    goto('2027-10-10');
    expect(await recTransactions()).toHaveLength(0);
    await api.post(`/api/payment-methods/${pix}/activate`);
    expect(await recTransactions()).toHaveLength(1);
  });

  it('CA-REC-13: cartão desativado em março e reativado em 05/05 — março e abril sem ocorrência', async () => {
    await setup('2027-01-01');
    const card = await api.card('Nubank', 6, 15);
    const rec = await createRec({
      payment_method_id: card.methodId,
      due_day: 10,
      description: 'Netflix',
      amount: 5000,
    });
    expect(rec.status).toBe(201);
    goto('2027-02-15');
    expect(await recTransactions()).toHaveLength(2);
    goto('2027-03-01');
    await api.post(`/api/credit-cards/${card.cardId}/deactivate`);
    goto('2027-04-15');
    await api.get('/api/transactions');
    goto('2027-05-05');
    await api.post(`/api/credit-cards/${card.cardId}/activate`);
    goto('2027-05-10');
    await api.get('/api/transactions');
    const months = (await recTransactions()).map((t) => t.occurrence_month);
    expect(months).toEqual(['2027-01', '2027-02', '2027-05']);
    expect((await api.get(`/api/recurrences/${rec.body.id}`)).body.status).toBe('ACTIVE');
  });

  it('CA-REC-14: ocorrência de cartão em 10/10 (melhor dia 6) → fatura de novembro', async () => {
    goto('2027-10-01');
    const card = await api.card('Nubank', 6, 15);
    await createRec({
      payment_method_id: card.methodId,
      due_day: 10,
      description: 'Netflix',
      amount: 5000,
    });
    // projeção
    const nov = await statement('2027-11');
    const item = (
      nov.items as {
        item_type: string;
        display_date: string;
        invoice: { reference_month: string; due_date: string };
      }[]
    )[0];
    expect(item).toMatchObject({
      item_type: 'PROJECTED_OCCURRENCE',
      display_date: '2027-10-10',
      invoice: { reference_month: '2027-11', due_date: '2027-11-15' },
    });
    expect((await statement('2027-10')).items).toHaveLength(0);
    // geração
    goto('2027-10-10');
    const txs = await recTransactions();
    expect(txs).toHaveLength(1);
    expect(txs[0]).toMatchObject({ financial_month: '2027-11', purchase_date: '2027-10-10' });
    expect(txs[0]?.invoice?.due_date).toBe('2027-11-15');
  });

  it('mês fechado: método comum não projeta nem gera (CA-REC-16)', async () => {
    await createRec({ due_day: 10 });
    await prisma.financialPeriod.create({
      data: { referenceMonth: '2027-10', status: 'CLOSED', closedAt: new Date() },
    });
    expect(await projected('2027-10')).toHaveLength(0);
    goto('2027-10-10');
    expect(await recTransactions()).toHaveLength(0);
    expect(await projected('2027-11')).toHaveLength(1);
  });
});

describe('pausa e cancelamento (T-28)', () => {
  beforeEach(() => setup('2026-12-01'));

  it('CA-REC-11: pausa agendada de 01/01 a 01/04 — sem ocorrências no intervalo; abril volta', async () => {
    const rec = await createRec({ due_day: 10, start_date: '2026-01-01', description: 'Netflix' });
    const pause = await api.post(`/api/recurrences/${rec.body.id}/pause`, {
      paused_from: '2027-01-01',
      paused_until: '2027-04-01',
    });
    expect(pause.body).toMatchObject({
      status: 'ACTIVE',
      paused_from: '2027-01-01',
      paused_until: '2027-04-01',
    });
    goto('2026-12-15');
    expect((await recTransactions()).map((t) => t.occurrence_month)).toEqual(['2026-12']);
    expect((await api.get(`/api/recurrences/${rec.body.id}`)).body.status).toBe('ACTIVE');
    expect(await projected('2027-01')).toHaveLength(0);
    expect(await projected('2027-04')).toHaveLength(1);

    goto('2027-01-15');
    expect((await api.get(`/api/recurrences/${rec.body.id}`)).body.status).toBe('PAUSED');
    goto('2027-03-20');
    expect(await recTransactions()).toHaveLength(1);
    goto('2027-04-15');
    expect((await api.get(`/api/recurrences/${rec.body.id}`)).body.status).toBe('ACTIVE');
    expect((await recTransactions()).map((t) => t.occurrence_month)).toEqual([
      '2026-12',
      '2027-04',
    ]);
  });

  it('pausa sem retorno e retomada sem ocorrências retroativas', async () => {
    const rec = await createRec({ due_day: 10, start_date: '2026-01-01' });
    await api.post(`/api/recurrences/${rec.body.id}/pause`, { paused_from: '2026-12-01' });
    expect((await api.get(`/api/recurrences/${rec.body.id}`)).body.status).toBe('PAUSED');
    expect(await projected('2027-06')).toHaveLength(0);
    goto('2027-02-20');
    expect(await recTransactions()).toHaveLength(0);
    const resumed = await api.post(`/api/recurrences/${rec.body.id}/resume`);
    expect(resumed.body.status).toBe('ACTIVE');
    expect(await recTransactions()).toHaveLength(0); // nada retroativo
    expect(await projected('2027-03')).toHaveLength(1);
    goto('2027-03-10');
    expect((await recTransactions()).map((t) => t.occurrence_month)).toEqual(['2027-03']);
  });

  it('retomar no dia da ocorrência a gera', async () => {
    const rec = await createRec({ due_day: 10, start_date: '2026-01-01' });
    await api.post(`/api/recurrences/${rec.body.id}/pause`, { paused_from: '2027-05-10' });
    goto('2027-05-10');
    expect((await api.get(`/api/recurrences/${rec.body.id}`)).body.status).toBe('PAUSED');
    // dezembro a abril foram gerados antes da pausa; maio (dia 10, em pausa) não
    expect((await recTransactions()).map((t) => t.occurrence_month)).not.toContain('2027-05');
    await api.post(`/api/recurrences/${rec.body.id}/resume`);
    expect((await recTransactions()).map((t) => t.occurrence_month)).toContain('2027-05');
  });

  it('retomar cancela uma pausa agendada', async () => {
    const rec = await createRec({ due_day: 10, start_date: '2026-01-01' });
    await api.post(`/api/recurrences/${rec.body.id}/pause`, { paused_from: '2027-01-01' });
    const res = await api.post(`/api/recurrences/${rec.body.id}/resume`);
    expect(res.body).toMatchObject({ status: 'ACTIVE', paused_from: null, paused_until: null });
    expect(await projected('2027-02')).toHaveLength(1);
    expect((await api.post(`/api/recurrences/${rec.body.id}/resume`)).body.error.code).toBe(
      'RECURRENCE_INVALID_STATE',
    );
  });

  it('validações da pausa', async () => {
    const rec = await createRec();
    const path = `/api/recurrences/${rec.body.id}/pause`;
    expect((await api.post(path, { paused_from: '2026-11-30' })).body.error.code).toBe(
      'INVALID_PAUSE_PERIOD',
    );
    expect(
      (await api.post(path, { paused_from: '2027-01-10', paused_until: '2027-01-10' })).body.error
        .code,
    ).toBe('INVALID_PAUSE_PERIOD');
    expect((await api.post(path, {})).status).toBe(400);
    await api.post(path, { paused_from: '2026-12-01' });
    expect((await api.post(path, { paused_from: '2026-12-05' })).body.error.code).toBe(
      'RECURRENCE_INVALID_STATE',
    );
  });

  it('CA-REC-12: cancelar preserva geradas, bloqueia novas e é definitivo', async () => {
    goto('2027-01-01');
    const rec = await createRec({ start_date: '2027-01-01' });
    goto('2027-02-10');
    expect(await recTransactions()).toHaveLength(2);
    const cancelled = await api.post(`/api/recurrences/${rec.body.id}/cancel`);
    expect(cancelled.body).toMatchObject({ status: 'CANCELLED', cancelled_at: '2027-02-10' });
    expect(await projected('2027-04')).toHaveLength(0);
    goto('2027-04-10');
    expect(await recTransactions()).toHaveLength(2);
    for (const call of [
      api.post(`/api/recurrences/${rec.body.id}/cancel`),
      api.put(`/api/recurrences/${rec.body.id}`, { amount: 1 }),
      api.post(`/api/recurrences/${rec.body.id}/pause`, { paused_from: '2027-04-10' }),
      api.post(`/api/recurrences/${rec.body.id}/resume`),
    ]) {
      expect((await call).body.error.code).toBe('RECURRENCE_CANCELLED');
    }
  });

  it('recorrência inexistente → 404', async () => {
    expect((await api.get('/api/recurrences/6f1c3c4e-0000-4000-8000-000000000000')).status).toBe(
      404,
    );
  });
});

describe('ações em ocorrências (T-31)', () => {
  beforeEach(() => setup('2027-10-01'));

  it('CA-REC-07: editar uma ocorrência gerada não altera a recorrência', async () => {
    const rec = await createRec({ due_day: 5 });
    goto('2027-10-05');
    const res = await api.put(`/api/recurrences/${rec.body.id}/occurrences/2027-10`, {
      amount: 99999,
      description: 'Aluguel (ajuste)',
    });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ amount: 99999, description: 'Aluguel (ajuste)' });
    const after = await api.get(`/api/recurrences/${rec.body.id}`);
    expect(after.body).toMatchObject({ amount: 150000, description: 'Aluguel' });
    expect((await projected('2027-11'))[0]?.amount).toBe(150000);
  });

  it('editar uma ocorrência projetada a gera com os valores editados (inclusive vencimento)', async () => {
    const rec = await createRec({ due_day: 20 });
    expect(await recTransactions()).toHaveLength(0);
    const res = await api.put(`/api/recurrences/${rec.body.id}/occurrences/2027-11`, {
      amount: 70000,
      due_date: '2027-12-02',
    });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      amount: 70000,
      due_date: '2027-12-02',
      financial_month: '2027-12',
      origin: 'RECURRENCE',
    });
    expect(await recTransactions()).toHaveLength(1);
    expect(await projected('2027-11')).toHaveLength(0); // não volta a ser projetada
  });

  it('CA-REC-08: categoria de ocorrência isolada não muda (e a rejeição não gera a ocorrência)', async () => {
    const rec = await createRec({ due_day: 20 });
    const other = await api.category('Outra', 'EXPENSE');
    const res = await api.put(`/api/recurrences/${rec.body.id}/occurrences/2027-11`, {
      category_id: other,
    });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('TRANSACTION_NOT_EDITABLE');
    expect(await recTransactions()).toHaveLength(0);
  });

  it('ocorrência inexistente (sem elegibilidade) → 404', async () => {
    const rec = await createRec({ due_day: 20, start_date: '2027-12-01' });
    const res = await api.put(`/api/recurrences/${rec.body.id}/occurrences/2027-11`, {
      amount: 100,
    });
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('RECURRENCE_OCCURRENCE_NOT_FOUND');
  });

  it('pagar ocorrência projetada com método comum a gera já paga', async () => {
    const rec = await createRec({ due_day: 20 });
    const res = await api.post(`/api/recurrences/${rec.body.id}/occurrences/2027-11/pay`, {
      paid_at: '2027-10-01',
    });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      status: 'PAID',
      paid_at: '2027-10-01',
      financial_month: '2027-11',
    });
  });

  it('CA-REC-09: pular a projetada de dezembro cria exceção; janeiro continua', async () => {
    const rec = await createRec({ due_day: 20 });
    expect(await projected('2027-12')).toHaveLength(1);
    const res = await api.post(`/api/recurrences/${rec.body.id}/occurrences/2027-12/skip`);
    expect(res.status).toBe(200);
    expect(await projected('2027-12')).toHaveLength(0);
    expect(await projected('2028-01')).toHaveLength(1);
    expect(await prisma.recurrenceException.count()).toBe(1);
    expect(await prisma.transaction.count()).toBe(0);
    const again = await api.post(`/api/recurrences/${rec.body.id}/occurrences/2027-12/skip`);
    expect(again.body.error.code).toBe('RECURRENCE_OCCURRENCE_NOT_SKIPPABLE');
    // a ocorrência pulada não é gerada na data
    goto('2027-12-20');
    expect((await recTransactions()).map((t) => t.occurrence_month)).not.toContain('2027-12');
  });

  it('CA-REC-10A: gerada, PIX e em aberto → remove o lançamento e cria a exceção', async () => {
    const rec = await createRec({ due_day: 5 });
    goto('2027-10-05');
    expect(await recTransactions()).toHaveLength(1);
    const res = await api.post(`/api/recurrences/${rec.body.id}/occurrences/2027-10/skip`);
    expect(res.status).toBe(200);
    expect(await recTransactions()).toHaveLength(0);
    expect(await prisma.recurrenceException.count()).toBe(1);
    goto('2027-11-05');
    expect((await recTransactions()).map((t) => t.occurrence_month)).toEqual(['2027-11']);
  });

  it('CA-REC-10: ocorrência paga não pode ser pulada', async () => {
    const rec = await createRec({ due_day: 5 });
    goto('2027-10-05');
    const tx = (await recTransactions())[0];
    await api.post(`/api/transactions/${tx?.id}/pay`, { paid_at: '2027-10-05' });
    const res = await api.post(`/api/recurrences/${rec.body.id}/occurrences/2027-10/skip`);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('RECURRENCE_OCCURRENCE_NOT_SKIPPABLE');
    // PD-38: pode ser apagada (não pode ser pulada)
    expect((await api.delete(`/api/transactions/${tx?.id}`)).status).toBe(204);
  });

  it('mês fechado: não pula, não edita e não paga a ocorrência (CA-REC-16)', async () => {
    const rec = await createRec({ due_day: 5 });
    goto('2027-10-05');
    await api.get('/api/transactions'); // gera a ocorrência de outubro
    await prisma.financialPeriod.create({
      data: { referenceMonth: '2027-10', status: 'CLOSED', closedAt: new Date() },
    });
    const base = `/api/recurrences/${rec.body.id}/occurrences/2027-10`;
    expect((await api.post(`${base}/skip`)).body.error.code).toBe(
      'RECURRENCE_OCCURRENCE_NOT_SKIPPABLE',
    );
    expect((await api.put(base, { amount: 1 })).body.error.code).toBe('PERIOD_CLOSED');
    expect((await api.post(`${base}/pay`, { paid_at: '2027-10-05' })).body.error.code).toBe(
      'PERIOD_CLOSED',
    );
    // alterações na recorrência também não atingem o mês fechado
    await api.put(`/api/recurrences/${rec.body.id}`, { amount: 1 });
    expect((await recTransactions())[0]?.amount).toBe(150000);
  });

  describe('com cartão', () => {
    let cardId: string;
    let cardMethod: string;

    beforeEach(async () => {
      const card = await api.card('Nubank', 6, 15);
      cardId = card.cardId;
      cardMethod = card.methodId;
    });

    it('CA-REC-10B: ocorrência gerada de cartão não pode ser pulada (pode ser apagada, PD-38)', async () => {
      const rec = await createRec({
        payment_method_id: cardMethod,
        due_day: 5,
        description: 'Netflix',
        amount: 5000,
      });
      goto('2027-10-05');
      const tx = (await recTransactions())[0];
      expect(tx).toBeTruthy();
      const res = await api.post(`/api/recurrences/${rec.body.id}/occurrences/2027-10/skip`);
      expect(res.body.error.code).toBe('RECURRENCE_OCCURRENCE_NOT_SKIPPABLE');
      expect((await api.delete(`/api/transactions/${tx?.id}`)).status).toBe(204);
    });

    it('a projetada de cartão pode ser pulada', async () => {
      const rec = await createRec({ payment_method_id: cardMethod, due_day: 20 });
      expect(
        (await api.post(`/api/recurrences/${rec.body.id}/occurrences/2027-11/skip`)).status,
      ).toBe(200);
      // 20/11 → ciclo de dezembro (pulada); 20/12 → ciclo de janeiro
      expect(await projected('2027-12')).toHaveLength(0);
      expect(await projected('2028-01')).toHaveLength(1);
    });

    it('pagar ocorrência de cartão individualmente é rejeitado (e não gera a ocorrência)', async () => {
      const rec = await createRec({ payment_method_id: cardMethod, due_day: 20 });
      const res = await api.post(`/api/recurrences/${rec.body.id}/occurrences/2027-11/pay`, {
        paid_at: '2027-10-01',
      });
      expect(res.body.error.code).toBe('CARD_TRANSACTION_SETTLED_BY_INVOICE');
      expect(await recTransactions()).toHaveLength(0);
    });

    it('CA-TRA-21/CA-REC-07A: valor editável enquanto a fatura não está PAID', async () => {
      const rec = await createRec({ payment_method_id: cardMethod, due_day: 3, amount: 5000 });
      goto('2027-10-03');
      const tx = (await recTransactions())[0];
      const ok = await api.put(`/api/recurrences/${rec.body.id}/occurrences/2027-10`, {
        amount: 6000,
      });
      expect(ok.status).toBe(200);
      expect(ok.body.amount).toBe(6000);
      expect((await api.get(`/api/recurrences/${rec.body.id}`)).body.amount).toBe(5000);

      goto('2027-10-20'); // fatura de outubro fecha em 06/10
      await api.post(`/api/invoices/${tx?.invoice?.id}/pay`, {
        paid_at: '2027-10-15',
        payment_method_id: pix,
      });
      const blocked = await api.put(`/api/recurrences/${rec.body.id}/occurrences/2027-10`, {
        amount: 7000,
      });
      expect(blocked.status).toBe(409);
      expect(blocked.body.error.code).toBe('INVOICE_ALREADY_PAID');
      // data e método de ocorrência de cartão também não mudam
      expect(
        (
          await api.put(`/api/recurrences/${rec.body.id}/occurrences/2027-11`, {
            due_date: '2027-11-30',
          })
        ).body.error.code,
      ).toBe('TRANSACTION_NOT_EDITABLE');
    });

    it('CA-EST-05/06/CA-REC-15: só ocorrência de cartão é estornável, sem afetar as demais', async () => {
      const card = await createRec({
        payment_method_id: cardMethod,
        due_day: 3,
        amount: 5000,
        description: 'Netflix',
      });
      const common = await createRec({ due_day: 3, amount: 5000, description: 'Spotify' });
      expect(card.status).toBe(201);
      expect(common.status).toBe(201);
      goto('2027-10-03');
      const txs = await recTransactions();
      expect(txs).toHaveLength(2);
      const cardTx = txs.find((t) => t.invoice);
      const pixTx = txs.find((t) => !t.invoice);
      const bad = await api.post('/api/refunds', {
        transaction_id: pixTx?.id,
        amount: 1000,
        refund_date: '2027-10-03',
      });
      expect(bad.body.error.code).toBe('REFUND_TARGET_NOT_ALLOWED');
      const ok = await api.post('/api/refunds', {
        transaction_id: cardTx?.id,
        amount: 5000,
        refund_date: '2027-10-03',
      });
      expect(ok.status).toBe(201);
      expect(await projected('2027-11')).toHaveLength(2);
      expect((await api.get(`/api/recurrences/${card.body.id}`)).body.status).toBe('ACTIVE');
      void cardId;
    });
  });
});
