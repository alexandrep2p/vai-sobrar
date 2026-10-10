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
  expense = await api.category('Despesas', 'EXPENSE');
  income = await api.category('Receitas', 'INCOME');
  pix = await api.systemMethod('PIX');
};
const goto = (date: string) => env.clock.set(parseLocalDate(date));
const close = (month: string) => api.post(`/api/financial-periods/${month}/close`);
const codeOf = (res: { body: { error?: { code: string } } }) => res.body.error?.code;

const manual = (
  description: string,
  amount: number,
  dueDate: string,
  extra: Record<string, unknown> = {},
) =>
  api.post('/api/transactions', {
    description,
    amount,
    due_date: dueDate,
    category_id: expense,
    payment_method_id: pix,
    ...extra,
  });
const paid = async (description: string, amount: number, dueDate: string) => {
  const t = await manual(description, amount, dueDate);
  await api.post(`/api/transactions/${t.body.id}/pay`, { paid_at: dueDate });
  return t.body.id as string;
};
const cardBuy = (
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

describe('fechamento de mês (T-33)', () => {
  beforeEach(() => setup('2027-09-30'));

  it('CA-PER-01/02: tudo pago não fecha sozinho; fechar registra closed_at', async () => {
    await paid('Aluguel', 150000, '2027-09-05');
    expect((await api.get('/api/financial-periods/2027-09')).body.status).toBe('OPEN');
    const res = await close('2027-09');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ reference_month: '2027-09', status: 'CLOSED' });
    expect(res.body.closed_at).toEqual(expect.any(String));
    expect((await api.get('/api/financial-periods/2027-09')).body.status).toBe('CLOSED');
  });

  it('CA-PER-03: lançamento PENDING impede o fechamento', async () => {
    goto('2027-09-01');
    await manual('Aluguel', 150000, '2027-09-05');
    goto('2027-09-30');
    const res = await close('2027-09');
    expect(res.status).toBe(409);
    expect(codeOf(res)).toBe('PERIOD_HAS_PENDING_TRANSACTIONS');
    expect(res.body.error.details).toMatchObject({ pending_transactions: 1 });
    expect(await prisma.financialPeriod.count()).toBe(0);
  });

  it('CA-PER-04: ocorrência projetada impede o fechamento; pular libera', async () => {
    await setup('2027-10-01');
    const rec = await api.post('/api/recurrences', {
      description: 'Luz',
      amount: 20000,
      category_id: expense,
      payment_method_id: pix,
      due_day: 20,
      start_date: '2027-10-01',
    });
    expect(codeOf(await close('2027-10'))).toBe('PERIOD_HAS_PENDING_TRANSACTIONS');
    await api.post(`/api/recurrences/${rec.body.id}/occurrences/2027-10/skip`);
    expect((await close('2027-10')).status).toBe(200);
  });

  it('CA-PER-04A: fatura não paga (inclusive só com créditos) impede o fechamento', async () => {
    await setup('2027-10-20');
    const card = await api.card('Nubank', 6, 15);
    const buy = await cardBuy(card.methodId, '2027-10-05', 20000);
    expect(codeOf(await close('2027-10'))).toBe('PERIOD_HAS_PENDING_TRANSACTIONS'); // parcela/compra em aberto
    await payInvoice(buy.body.invoice.id, '2027-10-14');
    expect((await close('2027-10')).status).toBe(200);

    // estorno total reconhecido em novembro → fatura de novembro só com créditos
    goto('2027-11-05');
    const refund = await api.post('/api/refunds', {
      transaction_id: buy.body.id,
      amount: 20000,
      refund_date: '2027-11-05',
    });
    expect(refund.status).toBe(201);
    const novInvoice = refund.body.allocations[0].invoice_id as string;
    expect(refund.body.allocations[0].invoice_reference_month).toBe('2027-11');
    goto('2027-11-20'); // a fatura de novembro fecha em 06/11
    const blocked = await close('2027-11');
    expect(blocked.status).toBe(409);
    expect(codeOf(blocked)).toBe('PERIOD_HAS_UNPAID_INVOICES');
    const pay = await payInvoice(novInvoice, '2027-11-19');
    expect(pay.status).toBe(200);
    expect(pay.body.totals.amount_due).toBe(0);
    expect((await close('2027-11')).status).toBe(200);
  });

  it('CA-PER-05: mês anterior aberto com lançamentos impede o fechamento', async () => {
    await setup('2027-09-30');
    await paid('Setembro', 1000, '2027-09-10');
    goto('2027-10-03');
    await paid('Outubro', 1000, '2027-10-03');
    goto('2027-10-31');
    const res = await close('2027-10');
    expect(res.status).toBe(409);
    expect(codeOf(res)).toBe('PERIOD_PREVIOUS_NOT_CLOSED');
    expect((await close('2027-09')).status).toBe(200);
    expect((await close('2027-10')).status).toBe(200);
  });

  it('CA-PER-05A: mês anterior sem nenhum lançamento não bloqueia', async () => {
    goto('2027-10-03');
    await paid('Outubro', 1000, '2027-10-03');
    goto('2027-10-31');
    expect((await close('2027-10')).status).toBe(200);
  });

  it('CA-PER-05B: mês futuro não fecha', async () => {
    const res = await close('2027-10');
    expect(res.status).toBe(409);
    expect(codeOf(res)).toBe('PERIOD_FUTURE_NOT_CLOSABLE');
  });

  it('CA-PER-05C: mês corrente fecha antes do último dia; depois, novos lançamentos nele são rejeitados', async () => {
    await setup('2027-09-15');
    await paid('Aluguel', 150000, '2027-09-05');
    expect((await close('2027-09')).status).toBe(200);
    const res = await manual('Tarde', 1000, '2027-09-28');
    expect(res.status).toBe(409);
    expect(codeOf(res)).toBe('PERIOD_CLOSED');
  });

  it('CA-PER-06: não há reabertura; fechar de novo é rejeitado', async () => {
    await paid('Aluguel', 150000, '2027-09-05');
    await close('2027-09');
    expect(codeOf(await close('2027-09'))).toBe('PERIOD_CLOSED');
    expect((await api.post('/api/financial-periods/2027-09/reopen')).status).toBe(404);
    expect((await api.delete('/api/financial-periods/2027-09')).status).toBe(404);
  });

  it('CA-PER-10: setembro fecha com compra de 25/09 na fatura de outubro ainda não paga', async () => {
    const card = await api.card('Nubank', 6, 15);
    await paid('Aluguel', 150000, '2027-09-05');
    const buy = await cardBuy(card.methodId, '2027-09-25');
    expect(buy.body.financial_month).toBe('2027-10');
    expect((await close('2027-09')).status).toBe(200);
  });

  it('CA-PER-08: fatura de mês fechado não recebe compra nem crédito e não é paga', async () => {
    await setup('2027-10-20');
    const card = await api.card('Nubank', 6, 15);
    const buy = await cardBuy(card.methodId, '2027-10-05', 20000);
    await payInvoice(buy.body.invoice.id, '2027-10-14');
    await close('2027-10');

    // compra do ciclo de outubro cadastrada depois → compra tardia (novembro)
    const late = await cardBuy(card.methodId, '2027-10-04', 5000);
    expect(late.status).toBe(201);
    expect(late.body.financial_month).toBe('2027-11');
    expect((await api.get(`/api/invoices/${buy.body.invoice.id}`)).body.transactions).toHaveLength(
      1,
    );
    // pagar fatura de mês fechado
    expect(codeOf(await payInvoice(buy.body.invoice.id, '2027-10-15'))).toBe(
      'INVOICE_ALREADY_PAID',
    );
  });

  it('CA-PER-09: estorno tardio de compra de mês fechado é reconhecido em mês aberto', async () => {
    await setup('2027-10-20');
    const card = await api.card('Nubank', 6, 15);
    const buy = await cardBuy(card.methodId, '2027-10-05', 20000);
    await payInvoice(buy.body.invoice.id, '2027-10-14');
    await close('2027-10');
    const before = await api.get('/api/monthly-statement?month=2027-10');
    const refund = await api.post('/api/refunds', {
      transaction_id: buy.body.id,
      amount: 5000,
      refund_date: '2027-10-20',
    });
    expect(refund.status).toBe(201);
    expect(refund.body.allocations[0].invoice_reference_month).toBe('2027-11');
    expect((await api.get('/api/monthly-statement?month=2027-10')).body).toEqual(before.body);
  });

  it('CA-PER-07: em mês fechado, criar/editar/excluir/status/mover data são rejeitados', async () => {
    const id = await paid('Aluguel', 150000, '2027-09-05');
    const pending = await manual('Outro', 5000, '2027-09-20');
    await api.post(`/api/transactions/${pending.body.id}/pay`, { paid_at: '2027-09-20' });
    await close('2027-09');
    const attempts = await Promise.all([
      manual('Novo', 1000, '2027-09-29'),
      api.put(`/api/transactions/${id}`, { description: 'X' }),
      api.delete(`/api/transactions/${id}`),
      api.post(`/api/transactions/${id}/unpay`),
      api.put(`/api/transactions/${id}`, { due_date: '2027-10-05' }),
    ]);
    for (const res of attempts) expect(codeOf(res)).toBe('PERIOD_CLOSED');
    // mover para dentro de mês fechado
    const open = await manual('Aberto', 1000, '2027-10-10');
    expect(
      codeOf(await api.put(`/api/transactions/${open.body.id}`, { due_date: '2027-09-30' })),
    ).toBe('PERIOD_CLOSED');
    // dados continuam consultáveis
    expect((await api.get(`/api/transactions/${id}`)).body.status).toBe('PAID');
    void income;
  });
});
