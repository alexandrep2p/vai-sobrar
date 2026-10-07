import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { parseLocalDate } from '../../src/shared/dates.js';
import { Api, prisma, setupEnv, type TestEnv } from './helpers.js';

let env: TestEnv;
let api: Api;
let category: string;
let pix: string;
let cardMethod: string;
let cardId: string;

afterAll(() => prisma.$disconnect());

const setup = async (today: string, best = 6, due = 15) => {
  env = await setupEnv(today);
  api = new Api(env);
  category = await api.category('Compras', 'EXPENSE');
  pix = await api.systemMethod('PIX');
  const card = await api.card('Nubank', best, due);
  cardMethod = card.methodId;
  cardId = card.cardId;
};

const buy = (purchaseDate: string, amount = 10000, extra: Record<string, unknown> = {}) =>
  api.post('/api/transactions', {
    description: 'Compra',
    amount,
    purchase_date: purchaseDate,
    category_id: category,
    payment_method_id: cardMethod,
    ...extra,
  });

const refund = (body: Record<string, unknown>) => api.post('/api/refunds', body);
const payInvoice = (invoiceId: string, paidAt: string) =>
  api.post(`/api/invoices/${invoiceId}/pay`, { paid_at: paidAt, payment_method_id: pix });
const invoiceDetail = async (id: string) => (await api.get(`/api/invoices/${id}`)).body;

describe('estorno de compra à vista (T-27)', () => {
  beforeEach(() => setup('2027-10-20'));

  it('CA-EST-01/13/15: total; compra preservada; fatura CLOSED não recebe crédito', async () => {
    const purchase = await buy('2027-10-05', 30000);
    const octInvoice = purchase.body.invoice.id as string;
    const res = await refund({
      transaction_id: purchase.body.id,
      amount: 30000,
      refund_date: '2027-10-10',
    });
    expect(res.status).toBe(201);
    // fatura de outubro está CLOSED → reconhecido na fatura do ciclo da refund_date (novembro)
    expect(res.body.allocations).toHaveLength(1);
    expect(res.body.allocations[0]).toMatchObject({
      amount: 30000,
      invoice_reference_month: '2027-11',
    });
    expect(res.body.allocations[0].invoice_id).not.toBe(octInvoice);

    const original = await api.get(`/api/transactions/${purchase.body.id}`);
    expect(original.body).toMatchObject({
      amount: 30000,
      status: 'PENDING',
      financial_month: '2027-10',
    });
    const oct = await invoiceDetail(octInvoice);
    expect(oct.totals).toMatchObject({ debits: 30000, credits: 0 });
    const nov = await invoiceDetail(res.body.allocations[0].invoice_id);
    expect(nov.totals).toMatchObject({
      debits: 0,
      credits: 30000,
      amount_due: 0,
      credit_balance: 30000,
    });

    const summary = await api.get(`/api/transactions/${purchase.body.id}/refunds`);
    expect(summary.body).toMatchObject({
      original_amount: 30000,
      refunded_amount: 30000,
      refundable_amount: 0,
      refund_status: 'FULLY_REFUNDED',
    });
    expect((await api.get(`/api/refunds/${res.body.id}`)).body.id).toBe(res.body.id);
  });

  it('CA-EST-02: estorno parcial reduz o líquido', async () => {
    const purchase = await buy('2027-10-05', 30000);
    const res = await refund({
      transaction_id: purchase.body.id,
      amount: 10000,
      refund_date: '2027-10-10',
    });
    expect(res.status).toBe(201);
    const summary = await api.get(`/api/transactions/${purchase.body.id}/refunds`);
    expect(summary.body).toMatchObject({
      refunded_amount: 10000,
      refundable_amount: 20000,
      refund_status: 'PARTIALLY_REFUNDED',
    });
  });

  it('CA-EST-03: acima do saldo estornável é rejeitado; igual ao saldo é aceito', async () => {
    const purchase = await buy('2027-10-05', 50000);
    const body = { transaction_id: purchase.body.id, refund_date: '2027-10-10' };
    expect((await refund({ ...body, amount: 30000 })).status).toBe(201);
    const over = await refund({ ...body, amount: 25000 });
    expect(over.status).toBe(422);
    expect(over.body.error.code).toBe('REFUND_EXCEEDS_REMAINING_AMOUNT');
    expect((await refund({ ...body, amount: 20000 })).status).toBe(201);
    expect((await refund({ ...body, amount: 1 })).body.error.code).toBe(
      'REFUND_EXCEEDS_REMAINING_AMOUNT',
    );
  });

  it('CA-EST-04: lançamento pago com PIX não é estornável', async () => {
    const manual = await api.post('/api/transactions', {
      description: 'Mercado',
      amount: 5000,
      due_date: '2027-10-25',
      category_id: category,
      payment_method_id: pix,
    });
    const res = await refund({
      transaction_id: manual.body.id,
      amount: 5000,
      refund_date: '2027-10-20',
    });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('REFUND_TARGET_NOT_ALLOWED');
  });

  it('parcela individual não é alvo (usa-se o plano)', async () => {
    const plan = await buy('2027-10-05', 20000, { installment_count: 2 });
    const parcel = plan.body.installment_plan.installments[0].transaction_id as string;
    const res = await refund({ transaction_id: parcel, amount: 1000, refund_date: '2027-10-10' });
    expect(res.body.error.code).toBe('REFUND_TARGET_NOT_ALLOWED');
  });

  it('CA-EST-14: refund_date anterior à compra ou futura é rejeitada', async () => {
    const purchase = await buy('2027-10-05', 10000);
    for (const refund_date of ['2027-10-04', '2027-10-21']) {
      const res = await refund({ transaction_id: purchase.body.id, amount: 100, refund_date });
      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe('INVALID_REFUND_DATE');
    }
    expect(
      (await refund({ transaction_id: purchase.body.id, amount: 100, refund_date: '2027-10-05' }))
        .status,
    ).toBe(201);
  });

  it('validação do corpo: um alvo, strategy só para plano, valor positivo', async () => {
    const purchase = await buy('2027-10-05', 10000);
    const base = { amount: 100, refund_date: '2027-10-10' };
    expect((await refund(base)).status).toBe(400);
    expect(
      (await refund({ ...base, transaction_id: purchase.body.id, strategy: 'PROPORTIONAL' }))
        .status,
    ).toBe(400);
    expect((await refund({ ...base, transaction_id: purchase.body.id, amount: 0 })).status).toBe(
      400,
    );
    expect((await refund({ ...base, installment_plan_id: purchase.body.id })).status).toBe(400);
  });

  it('o crédito vai para a fatura do alvo quando ela está OPEN', async () => {
    await setup('2027-10-06');
    const purchase = await buy('2027-10-05', 10000);
    const res = await refund({
      transaction_id: purchase.body.id,
      amount: 4000,
      refund_date: '2027-10-06',
    });
    expect(res.body.allocations[0].invoice_id).toBe(purchase.body.invoice.id);
    const invoice = await invoiceDetail(purchase.body.invoice.id);
    expect(invoice.totals).toMatchObject({ debits: 10000, credits: 4000, amount_due: 6000 });
    expect(invoice.credits).toHaveLength(1);
    expect(await prisma.invoice.count()).toBe(1);
  });

  it('CA-EST-11: compra de mês fechado → crédito na fatura do ciclo da refund_date', async () => {
    await setup('2027-04-20');
    const purchase = await buy('2027-04-05', 30000);
    await payInvoice(purchase.body.invoice.id, '2027-04-14');
    await prisma.financialPeriod.create({
      data: {
        userId: env.userId,
        referenceMonth: '2027-04',
        status: 'CLOSED',
        closedAt: new Date(),
      },
    });
    env.clock.set(parseLocalDate('2027-06-03'));
    const res = await refund({
      transaction_id: purchase.body.id,
      amount: 30000,
      refund_date: '2027-06-03',
    });
    expect(res.status).toBe(201);
    expect(res.body.allocations[0]).toMatchObject({ invoice_reference_month: '2027-06' });
    const april = await invoiceDetail(purchase.body.invoice.id);
    expect(april).toMatchObject({ status: 'PAID' });
    expect(april.totals.credits).toBe(0);
  });

  it('ciclos passados sem fatura são pulados, sem criar fatura vazia', async () => {
    await setup('2027-04-20');
    const purchase = await buy('2027-04-05', 30000);
    await payInvoice(purchase.body.invoice.id, '2027-04-14');
    env.clock.set(parseLocalDate('2027-06-10'));
    const res = await refund({
      transaction_id: purchase.body.id,
      amount: 1000,
      refund_date: '2027-05-03',
    });
    // ciclos de maio e junho já fecharam (06/05 e 06/06): vai para julho
    expect(res.body.allocations[0].invoice_reference_month).toBe('2027-07');
    const months = (await prisma.invoice.findMany()).map((i) => i.referenceMonth).sort();
    expect(months).toEqual(['2027-04', '2027-07']);
  });
});

describe('estorno de compra parcelada (T-27)', () => {
  beforeEach(() => setup('2027-10-06'));

  const plan = async (total: number, count: number, date = '2027-10-05') => {
    const res = await buy(date, total, { installment_count: count });
    return res.body.installment_plan as {
      id: string;
      installments: {
        number: number;
        transaction_id: string;
        invoice: { id: string; reference_month: string };
      }[];
    };
  };

  const byParcel = (body: { allocations: { installment_number: number; amount: number }[] }) =>
    body.allocations.map((a) => [a.installment_number, a.amount]);

  it('CA-EST-07: FIRST_INSTALLMENTS, 4x R$100, estorno R$150 → 100 / 50', async () => {
    const p = await plan(40000, 4);
    const res = await refund({
      installment_plan_id: p.id,
      amount: 15000,
      refund_date: '2027-10-06',
      strategy: 'FIRST_INSTALLMENTS',
    });
    expect(res.status).toBe(201);
    expect(byParcel(res.body)).toEqual([
      [1, 10000],
      [2, 5000],
    ]);
    // reconhecidas nas faturas das próprias parcelas (OPEN)
    expect(
      res.body.allocations.map(
        (a: { invoice_reference_month: string }) => a.invoice_reference_month,
      ),
    ).toEqual(['2027-10', '2027-11']);
  });

  it('CA-EST-08: LAST_INSTALLMENTS → 50 / 100 nas parcelas 3 e 4', async () => {
    const p = await plan(40000, 4);
    const res = await refund({
      installment_plan_id: p.id,
      amount: 15000,
      refund_date: '2027-10-06',
      strategy: 'LAST_INSTALLMENTS',
    });
    expect(byParcel(res.body)).toEqual([
      [3, 5000],
      [4, 10000],
    ]);
  });

  it('CA-EST-09: PROPORTIONAL, 3x R$100, estorno R$90 → 30 / 30 / 30', async () => {
    const p = await plan(30000, 3);
    const res = await refund({
      installment_plan_id: p.id,
      amount: 9000,
      refund_date: '2027-10-06',
      strategy: 'PROPORTIONAL',
    });
    expect(byParcel(res.body)).toEqual([
      [1, 3000],
      [2, 3000],
      [3, 3000],
    ]);
  });

  it('CA-EST-10: PROPORTIONAL sobre 33,33 / 33,33 / 33,34 soma exatamente o estornado', async () => {
    const p = await plan(10000, 3);
    const res = await refund({
      installment_plan_id: p.id,
      amount: 5001,
      refund_date: '2027-10-06',
      strategy: 'PROPORTIONAL',
    });
    const total = (res.body.allocations as { amount: number }[]).reduce((s, a) => s + a.amount, 0);
    expect(total).toBe(5001);
    const full = await refund({
      installment_plan_id: p.id,
      amount: 4999,
      refund_date: '2027-10-06',
      strategy: 'PROPORTIONAL',
    });
    expect(full.status).toBe(201);
    const summary = await api.get(`/api/installment-plans/${p.id}/refunds`);
    expect(summary.body).toMatchObject({
      refunded_amount: 10000,
      refundable_amount: 0,
      refund_status: 'FULLY_REFUNDED',
    });
    expect(summary.body.data).toHaveLength(2);
    // valor original das parcelas inalterado (CA-EST-13)
    const planAfter = await api.get(`/api/installment-plans/${p.id}`);
    expect((planAfter.body.installments as { amount: number }[]).map((i) => i.amount)).toEqual([
      3333, 3333, 3334,
    ]);
  });

  it('múltiplos estornos respeitam o saldo por parcela', async () => {
    const p = await plan(40000, 4);
    const body = { installment_plan_id: p.id, refund_date: '2027-10-06' };
    await refund({ ...body, amount: 15000, strategy: 'FIRST_INSTALLMENTS' });
    const second = await refund({ ...body, amount: 10000, strategy: 'FIRST_INSTALLMENTS' });
    expect(byParcel(second.body)).toEqual([
      [2, 5000],
      [3, 5000],
    ]);
    const over = await refund({ ...body, amount: 20000, strategy: 'LAST_INSTALLMENTS' });
    expect(over.body.error.code).toBe('REFUND_EXCEEDS_REMAINING_AMOUNT');
  });

  it('primeira parcela já paga: crédito vai para a fatura do estorno; demais, para as suas faturas', async () => {
    await setup('2027-10-20');
    const p = await plan(40000, 4, '2027-10-05');
    await payInvoice(p.installments[0]?.invoice.id as string, '2027-10-14');
    const res = await refund({
      installment_plan_id: p.id,
      amount: 15000,
      refund_date: '2027-10-20',
      strategy: 'FIRST_INSTALLMENTS',
    });
    expect(res.status).toBe(201);
    const [first, second] = res.body.allocations as {
      installment_number: number;
      invoice_id: string;
      invoice_reference_month: string;
    }[];
    // 1/4: fatura de outubro está PAID → fatura do ciclo do estorno (novembro)
    expect(first).toMatchObject({ installment_number: 1, invoice_reference_month: '2027-11' });
    // 2/4: fatura de novembro está OPEN → a própria fatura da parcela
    expect(second).toMatchObject({
      installment_number: 2,
      invoice_id: p.installments[1]?.invoice.id,
    });
    const oct = await invoiceDetail(p.installments[0]?.invoice.id as string);
    expect(oct).toMatchObject({ status: 'PAID' });
    expect(oct.totals.credits).toBe(0);
  });

  it('plano inexistente → 404', async () => {
    const res = await refund({
      installment_plan_id: '6f1c3c4e-0000-4000-8000-000000000000',
      amount: 100,
      refund_date: '2027-10-06',
      strategy: 'PROPORTIONAL',
    });
    expect(res.status).toBe(404);
  });
});

describe('saldo credor (T-25, T-27)', () => {
  /** Oct (CLOSED): Y=200; Nov: X=100 + crédito de 150 → valor a pagar 0 e saldo credor 50. */
  const prepare = async () => {
    await setup('2027-10-20');
    const y = await buy('2027-10-05', 20000);
    const x = await buy('2027-10-08', 10000);
    const r = await refund({ transaction_id: y.body.id, amount: 15000, refund_date: '2027-10-20' });
    return { novInvoice: x.body.invoice.id as string, refundBody: r.body };
  };

  it('CA-FAT-12/20: fatura com valor a pagar zero continua CLOSED e atrasada até ser paga', async () => {
    const { novInvoice, refundBody } = await prepare();
    expect(refundBody.allocations[0].invoice_id).toBe(novInvoice);
    env.clock.set(parseLocalDate('2027-11-20'));
    const nov = await invoiceDetail(novInvoice);
    expect(nov).toMatchObject({ status: 'CLOSED', situation: 'OVERDUE' });
    expect(nov.totals).toMatchObject({
      debits: 10000,
      credits: 15000,
      amount_due: 0,
      credit_balance: 5000,
    });
  });

  it('CA-FAT-10/11/21: saldo credor é transferido para a próxima fatura mesmo CLOSED, sem criar lançamento', async () => {
    const { novInvoice } = await prepare();
    const z = await buy('2027-11-10', 30000); // ciclo de dezembro
    const decInvoice = z.body.invoice.id as string;
    env.clock.set(parseLocalDate('2027-12-10')); // novembro e dezembro CLOSED
    const before = await prisma.transaction.count();

    const pay = await payInvoice(novInvoice, '2027-12-01');
    expect(pay.status).toBe(200);
    expect(pay.body).toMatchObject({
      status: 'PAID',
      credit_balance: 5000,
      credit_transferred_to_invoice_id: decInvoice,
    });
    expect(pay.body.totals.amount_due).toBe(0);
    expect(await prisma.transaction.count()).toBe(before);

    const dec = await invoiceDetail(decInvoice);
    expect(dec.status).toBe('CLOSED');
    expect(dec.totals).toMatchObject({ debits: 30000, received_credit: 5000, amount_due: 25000 });
    expect(dec.received_credits).toEqual([
      { invoice_id: novInvoice, reference_month: '2027-11', amount: 5000 },
    ]);
  });

  it('transferência fica pendente e é vinculada quando uma fatura posterior é criada', async () => {
    const { novInvoice } = await prepare();
    env.clock.set(parseLocalDate('2027-11-20'));
    const pay = await payInvoice(novInvoice, '2027-11-18');
    expect(pay.body).toMatchObject({
      credit_balance: 5000,
      credit_transferred_to_invoice_id: null,
    });

    const later = await buy('2027-11-25', 20000); // ciclo de dezembro, fatura criada agora
    const dec = await invoiceDetail(later.body.invoice.id);
    expect(dec.totals).toMatchObject({ debits: 20000, received_credit: 5000, amount_due: 15000 });
    const nov = await invoiceDetail(novInvoice);
    expect(nov.credit_transferred_to_invoice_id).toBe(later.body.invoice.id);
  });

  it('cascata: crédito recebido maior que os débitos segue adiante no pagamento', async () => {
    const { novInvoice } = await prepare();
    const small = await buy('2027-11-10', 3000); // dezembro: 30
    await buy('2028-01-05', 7000); // janeiro existe
    env.clock.set(parseLocalDate('2028-01-10'));
    await payInvoice(novInvoice, '2027-12-20'); // 50 → dezembro
    const decId = small.body.invoice.id as string;
    const dec = await invoiceDetail(decId);
    expect(dec.totals).toMatchObject({
      debits: 3000,
      received_credit: 5000,
      amount_due: 0,
      credit_balance: 2000,
    });
    const paidDec = await payInvoice(decId, '2028-01-09');
    expect(paidDec.body).toMatchObject({ credit_balance: 2000 });
    expect(paidDec.body.credit_transferred_to_invoice_id).not.toBeNull();
    const jan = await invoiceDetail(paidDec.body.credit_transferred_to_invoice_id);
    expect(jan.reference_month).toBe('2028-01');
    expect(jan.totals).toMatchObject({ debits: 7000, received_credit: 2000, amount_due: 5000 });
  });

  it('CA-FAT-18: alvo em fatura CLOSED — a fatura CLOSED não recebe crédito', async () => {
    await setup('2027-10-20');
    const y = await buy('2027-10-05', 20000);
    const res = await refund({
      transaction_id: y.body.id,
      amount: 5000,
      refund_date: '2027-10-20',
    });
    expect(res.body.allocations[0].invoice_id).not.toBe(y.body.invoice.id);
    expect((await invoiceDetail(y.body.invoice.id)).totals.credits).toBe(0);
    void cardId;
  });
});
