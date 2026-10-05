import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { parseLocalDate } from '../../src/shared/dates.js';
import { Api, prisma, setupEnv, type TestEnv } from './helpers.js';

// T-53 / PD-35: recorrências de cartão previstas somam na fatura; pagar gera e liquida.

let env: TestEnv;
let api: Api;
let expense: string;
let pix: string;
let cardId: string;
let cardMethod: string;
let recurrenceId: string;
let novInvoiceId: string;

afterAll(() => prisma.$disconnect());

interface Summary {
  id: string | null;
  reference_month: string;
  persisted: boolean;
  status: string;
  projected_total: number;
  totals: { debits: number; amount_due: number };
}
interface Detail extends Summary {
  transactions: { description: string; amount: number }[];
  projected_items: {
    recurrence_id: string;
    occurrence_month: string;
    description: string;
    amount: number;
    purchase_date: string;
  }[];
}

const invoices = async (from: string, to: string) =>
  (await api.get(`/api/credit-cards/${cardId}/invoices?from=${from}&to=${to}`)).body
    .data as Summary[];
const byMonth = (list: Summary[], month: string) =>
  list.find((i) => i.reference_month === month) as Summary;
const cycle = async (month: string) =>
  (await api.get(`/api/credit-cards/${cardId}/invoices/${month}`)).body as Detail;
const detailOf = async (id: string) => (await api.get(`/api/invoices/${id}`)).body as Detail;
const recTransactions = async () =>
  (
    (await api.get('/api/transactions?origin=RECURRENCE')).body.data as {
      occurrence_month: string;
      status: string;
      purchase_date: string;
      invoice: { id: string } | null;
    }[]
  ).sort((a, b) => a.occurrence_month.localeCompare(b.occurrence_month));
const pay = (invoiceId: string, paidAt = '2027-10-01') =>
  api.post(`/api/invoices/${invoiceId}/pay`, { paid_at: paidAt, payment_method_id: pix });

describe('fatura com ocorrências previstas (PD-35)', () => {
  beforeEach(async () => {
    env = await setupEnv('2027-10-01');
    api = new Api(env);
    expense = await api.category('Despesas', 'EXPENSE');
    pix = await api.systemMethod('PIX');
    ({ cardId, methodId: cardMethod } = await api.card('Nubank', 6, 15));
    // compra de 07/10 vai para o ciclo de novembro (fecha 06/11, vence 15/11): fatura persistida
    const buy = await api.post('/api/transactions', {
      description: 'Mercado',
      amount: 50000,
      purchase_date: '2027-10-07',
      category_id: expense,
      payment_method_id: cardMethod,
    });
    novInvoiceId = buy.body.invoice.id as string;
    // Netflix R$ 40 no dia 10: a cobrança de 10/10 cai na fatura de novembro; a de 10/11, na de dezembro
    const rec = await api.post('/api/recurrences', {
      description: 'Netflix',
      amount: 4000,
      category_id: expense,
      payment_method_id: cardMethod,
      due_day: 10,
      start_date: '2027-10-01',
    });
    recurrenceId = rec.body.id as string;
  });

  it('CA-FAT-16A: o detalhe lista o previsto e o total soma real + previsto', async () => {
    const detail = await detailOf(novInvoiceId);
    expect(detail.transactions.map((t) => t.description)).toEqual(['Mercado']);
    expect(detail.projected_items).toEqual([
      expect.objectContaining({
        recurrence_id: recurrenceId,
        occurrence_month: '2027-10',
        description: 'Netflix',
        amount: 4000,
        purchase_date: '2027-10-10',
      }),
    ]);
    expect(detail.projected_total).toBe(4000);
    expect(detail.totals).toMatchObject({ debits: 54000, amount_due: 54000 });
  });

  it('a lista mostra o previsto na fatura persistida e nos ciclos futuros sem fatura', async () => {
    const list = await invoices('2027-10', '2028-01');
    expect(byMonth(list, '2027-10')).toMatchObject({ projected_total: 0 });
    expect(byMonth(list, '2027-11')).toMatchObject({
      persisted: true,
      projected_total: 4000,
      totals: { amount_due: 54000 },
    });
    expect(byMonth(list, '2027-12')).toMatchObject({
      persisted: false,
      projected_total: 4000,
      totals: { debits: 4000, amount_due: 4000 },
    });
  });

  it('ciclo futuro sem fatura tem detalhe com o previsto', async () => {
    const detail = await cycle('2027-12');
    expect(detail).toMatchObject({ persisted: false, id: null, projected_total: 4000 });
    expect(detail.projected_items).toHaveLength(1);
    expect(detail.transactions).toEqual([]);
  });

  it('CA-FAT-16: ciclo sem lançamentos e sem previsão continua "Sem lançamentos"', async () => {
    const cancel = await api.post(`/api/recurrences/${recurrenceId}/cancel`);
    expect(cancel.status).toBe(200);
    const detail = await cycle('2027-12');
    expect(detail).toMatchObject({ persisted: false, projected_total: 0 });
    expect(detail.projected_items).toEqual([]);
    expect(detail.totals.amount_due).toBe(0);
  });

  it('CA-FAT-16B: ocorrência pulada não aparece como previsto', async () => {
    const skip = await api.post(`/api/recurrences/${recurrenceId}/occurrences/2027-10/skip`);
    expect(skip.status).toBe(200);
    const detail = await detailOf(novInvoiceId);
    expect(detail.projected_total).toBe(0);
    expect(detail.totals.amount_due).toBe(50000);
  });

  it('CA-FAT-16B: recorrência pausada na data não aparece como previsto', async () => {
    const paused = await api.post(`/api/recurrences/${recurrenceId}/pause`, {
      paused_from: '2027-10-05',
    });
    expect(paused.status).toBe(200);
    const detail = await detailOf(novInvoiceId);
    expect(detail.projected_total).toBe(0);
  });

  it('pagar a fatura gera a ocorrência prevista e quita real + previsto', async () => {
    const res = await pay(novInvoiceId);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: 'PAID', projected_total: 0, projected_items: [] });
    expect(res.body.transactions).toHaveLength(2);
    expect(res.body.totals.debits).toBe(54000);

    const generated = await recTransactions();
    expect(generated).toHaveLength(1);
    expect(generated[0]).toMatchObject({
      occurrence_month: '2027-10',
      status: 'PAID',
      purchase_date: '2027-10-10',
      invoice: { id: novInvoiceId },
    });
  });

  it('depois de paga, a fatura não recebe previsão e a ocorrência não é duplicada na data', async () => {
    await pay(novInvoiceId);
    const detail = await detailOf(novInvoiceId);
    expect(detail.projected_total).toBe(0);

    // a data chega: a geração por data não duplica a ocorrência já gerada pelo pagamento
    env.clock.set(parseLocalDate('2027-10-10'));
    await api.get('/api/credit-cards');
    expect(await recTransactions()).toHaveLength(1);

    // as próximas ocorrências continuam previstas nas faturas seguintes
    const dec = await cycle('2027-12');
    expect(dec.projected_items.map((i) => i.occurrence_month)).toEqual(['2027-11']);
  });

  it('fatura PAID não recebe previsão de recorrência criada depois', async () => {
    await pay(novInvoiceId);
    const second = await api.post('/api/recurrences', {
      description: 'Spotify',
      amount: 2000,
      category_id: expense,
      payment_method_id: cardMethod,
      due_day: 12,
      start_date: '2027-10-01',
    });
    expect(second.status).toBe(201);
    const detail = await detailOf(novInvoiceId);
    expect(detail.projected_items).toEqual([]);
    // a ocorrência de 12/10 (ciclo de novembro, já pago) cai na próxima fatura não paga: dezembro
    const dec = await cycle('2027-12');
    expect(dec.projected_items.map((i) => i.description)).toContain('Spotify');
  });
});
