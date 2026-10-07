import type { PrismaClient } from '@prisma/client';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { scopedPrisma } from '../../src/shared/tenant.js';
import { prisma, resetDatabase } from './db.js';

// Registros de negócio pertencem a um usuário (PD-40): o cliente restrito grava o user_id.
let db: PrismaClient;

const date = (iso: string): Date => new Date(`${iso}T00:00:00.000Z`);

const makeCategory = (name = 'Mercado') => db.category.create({ data: { name, type: 'EXPENSE' } });

const makeMethod = (name = 'PIX') => db.paymentMethod.create({ data: { name, source: 'SYSTEM' } });

const makeCard = async (name = 'Nubank') => {
  const method = await db.paymentMethod.create({
    data: { name, source: 'USER', kind: 'CREDIT_CARD' },
  });
  const card = await db.creditCard.create({
    data: { paymentMethodId: method.id, bestPurchaseDay: 6, dueDay: 15 },
  });
  return { method, card };
};

const invoiceData = (creditCardId: string, referenceMonth = '2027-10') => ({
  creditCardId,
  referenceMonth,
  closingDate: date('2027-10-06'),
  dueDate: date('2027-10-15'),
});

const transactionData = async () => {
  const [category, method] = await Promise.all([makeCategory(), makeMethod()]);
  return {
    description: 'Compra',
    amount: 1000,
    financialMonth: '2027-10',
    dueDate: date('2027-10-15'),
    categoryId: category.id,
    paymentMethodId: method.id,
    origin: 'MANUAL' as const,
  };
};

describe('constraints do schema', () => {
  beforeEach(async () => {
    await resetDatabase();
    const user = await prisma.user.create({
      data: {
        name: 'Teste Constraints',
        username: 'constraints',
        email: 'c@teste.com',
        passwordHash: 'x',
      },
    });
    db = scopedPrisma(prisma, user.id);
  });
  afterAll(() => prisma.$disconnect());

  it('financial_periods: reference_month único e no formato YYYY-MM', async () => {
    await db.financialPeriod.create({ data: { referenceMonth: '2027-09' } });
    await expect(
      db.financialPeriod.create({ data: { referenceMonth: '2027-09' } }),
    ).rejects.toThrow();
    await expect(
      db.financialPeriod.create({ data: { referenceMonth: '2027-13' } }),
    ).rejects.toThrow();
  });

  it('categories e payment_methods: nome único sem diferenciar maiúsculas/minúsculas', async () => {
    await makeCategory('Mercado');
    await expect(makeCategory('MERCADO')).rejects.toThrow();
    await makeMethod('Pix');
    await expect(makeMethod('pix')).rejects.toThrow();
  });

  it('credit_cards: payment_method_id único e dias entre 1 e 31', async () => {
    const { method } = await makeCard();
    await expect(
      db.creditCard.create({
        data: { paymentMethodId: method.id, bestPurchaseDay: 1, dueDay: 1 },
      }),
    ).rejects.toThrow();
    const other = await makeMethod('Outro');
    for (const days of [
      { bestPurchaseDay: 0, dueDay: 10 },
      { bestPurchaseDay: 10, dueDay: 32 },
    ]) {
      await expect(
        db.creditCard.create({ data: { paymentMethodId: other.id, ...days } }),
      ).rejects.toThrow();
    }
  });

  it('invoices: (cartão, mês) único e due_date > closing_date', async () => {
    const { card } = await makeCard();
    await db.invoice.create({ data: invoiceData(card.id) });
    await expect(db.invoice.create({ data: invoiceData(card.id) })).rejects.toThrow();
    await expect(
      db.invoice.create({
        data: { ...invoiceData(card.id, '2027-11'), dueDate: date('2027-10-06') },
      }),
    ).rejects.toThrow();
    const { card: card2 } = await makeCard('Inter');
    await expect(db.invoice.create({ data: invoiceData(card2.id) })).resolves.toBeTruthy();
  });

  it('invoices: dados de pagamento somente com status PAID', async () => {
    const { card } = await makeCard();
    const pix = await makeMethod();
    await expect(
      db.invoice.create({ data: { ...invoiceData(card.id), paidAt: date('2027-10-14') } }),
    ).rejects.toThrow();
    await expect(
      db.invoice.create({ data: { ...invoiceData(card.id), status: 'PAID' } }),
    ).rejects.toThrow();
    await expect(
      db.invoice.create({
        data: {
          ...invoiceData(card.id),
          status: 'PAID',
          paidAt: date('2027-10-14'),
          paymentMethodId: pix.id,
        },
      }),
    ).resolves.toBeTruthy();
  });

  it('installments: plano com no mínimo 2 parcelas; (plano, número) e transação únicos', async () => {
    const { card } = await makeCard();
    await expect(
      db.installmentPlan.create({
        data: {
          creditCardId: card.id,
          totalAmount: 1000,
          installmentCount: 1,
          purchaseDate: date('2027-10-05'),
        },
      }),
    ).rejects.toThrow();
    const plan = await db.installmentPlan.create({
      data: {
        creditCardId: card.id,
        totalAmount: 1000,
        installmentCount: 2,
        purchaseDate: date('2027-10-05'),
      },
    });
    const base = await transactionData();
    const t1 = await db.transaction.create({ data: { ...base, origin: 'INSTALLMENT' } });
    const t2 = await db.transaction.create({ data: { ...base, origin: 'INSTALLMENT' } });
    await db.installment.create({
      data: { installmentPlanId: plan.id, transactionId: t1.id, number: 1 },
    });
    await expect(
      db.installment.create({
        data: { installmentPlanId: plan.id, transactionId: t2.id, number: 1 },
      }),
    ).rejects.toThrow();
    await expect(
      db.installment.create({
        data: { installmentPlanId: plan.id, transactionId: t1.id, number: 2 },
      }),
    ).rejects.toThrow();
  });

  it('transactions: amount > 0', async () => {
    const base = await transactionData();
    await expect(db.transaction.create({ data: { ...base, amount: 0 } })).rejects.toThrow();
    await expect(db.transaction.create({ data: { ...base, amount: -5 } })).rejects.toThrow();
    await expect(db.transaction.create({ data: base })).resolves.toBeTruthy();
  });

  it('transactions: paid_at nulo se e somente se PENDING', async () => {
    const base = await transactionData();
    await expect(db.transaction.create({ data: { ...base, status: 'PAID' } })).rejects.toThrow();
    await expect(
      db.transaction.create({
        data: { ...base, status: 'PENDING', paidAt: date('2027-10-10') },
      }),
    ).rejects.toThrow();
    await expect(
      db.transaction.create({ data: { ...base, status: 'PAID', paidAt: date('2027-10-10') } }),
    ).resolves.toBeTruthy();
  });

  it('transactions: (recurrence_id, occurrence_month) único para ocorrências', async () => {
    const base = await transactionData();
    const recurrence = await db.recurrence.create({
      data: {
        description: 'Aluguel',
        amount: 150000,
        categoryId: base.categoryId,
        paymentMethodId: base.paymentMethodId,
        dueDay: 8,
        startDate: date('2027-01-01'),
      },
    });
    const occurrence = {
      ...base,
      origin: 'RECURRENCE' as const,
      recurrenceId: recurrence.id,
      occurrenceMonth: '2027-10',
    };
    await db.transaction.create({ data: occurrence });
    await expect(db.transaction.create({ data: occurrence })).rejects.toThrow();
    await expect(
      db.transaction.create({ data: { ...occurrence, occurrenceMonth: '2027-11' } }),
    ).resolves.toBeTruthy();
    // lançamentos sem recorrência não colidem entre si
    await db.transaction.create({ data: base });
    await expect(db.transaction.create({ data: base })).resolves.toBeTruthy();
    // dados de recorrência somente na origem RECURRENCE
    await expect(
      db.transaction.create({ data: { ...base, recurrenceId: recurrence.id } }),
    ).rejects.toThrow();
  });

  it('recurrence_exceptions: (recurrence_id, occurrence_month) único', async () => {
    const base = await transactionData();
    const recurrence = await db.recurrence.create({
      data: {
        description: 'Netflix',
        amount: 5000,
        categoryId: base.categoryId,
        paymentMethodId: base.paymentMethodId,
        dueDay: 10,
        startDate: date('2027-01-01'),
      },
    });
    const data = { recurrenceId: recurrence.id, occurrenceMonth: '2027-12' };
    await db.recurrenceException.create({ data });
    await expect(db.recurrenceException.create({ data })).rejects.toThrow();
  });

  it('recurrences: cancelled_at somente quando CANCELLED; valor > 0; dia 1..31', async () => {
    const base = await transactionData();
    const data = {
      description: 'Luz',
      amount: 20000,
      categoryId: base.categoryId,
      paymentMethodId: base.paymentMethodId,
      dueDay: 20,
      startDate: date('2027-01-01'),
    };
    await expect(db.recurrence.create({ data })).resolves.toBeTruthy();
    await expect(
      db.recurrence.create({ data: { ...data, cancelledAt: date('2027-05-10') } }),
    ).rejects.toThrow();
    await expect(
      db.recurrence.create({ data: { ...data, status: 'CANCELLED' } }),
    ).rejects.toThrow();
    await expect(
      db.recurrence.create({
        data: { ...data, status: 'CANCELLED', cancelledAt: date('2027-05-10') },
      }),
    ).resolves.toBeTruthy();
    await expect(db.recurrence.create({ data: { ...data, amount: 0 } })).rejects.toThrow();
    await expect(db.recurrence.create({ data: { ...data, dueDay: 32 } })).rejects.toThrow();
  });

  describe('refunds', () => {
    const setup = async () => {
      const { card } = await makeCard();
      const invoice = await db.invoice.create({ data: invoiceData(card.id) });
      const base = await transactionData();
      const transaction = await db.transaction.create({
        data: { ...base, origin: 'CREDIT_CARD', invoiceId: invoice.id },
      });
      const plan = await db.installmentPlan.create({
        data: {
          creditCardId: card.id,
          totalAmount: 3000,
          installmentCount: 3,
          purchaseDate: date('2027-10-05'),
        },
      });
      return { invoice, transaction, plan };
    };

    it('exatamente um alvo, strategy se e somente se houver plano, amount > 0', async () => {
      const { transaction, plan } = await setup();
      const refundDate = date('2027-10-10');
      const create = (data: object) =>
        db.refund.create({ data: { amount: 500, refundDate, ...data } });

      await expect(create({})).rejects.toThrow();
      await expect(
        create({
          transactionId: transaction.id,
          installmentPlanId: plan.id,
          strategy: 'PROPORTIONAL',
        }),
      ).rejects.toThrow();
      await expect(
        create({ transactionId: transaction.id, strategy: 'PROPORTIONAL' }),
      ).rejects.toThrow();
      await expect(create({ installmentPlanId: plan.id })).rejects.toThrow();
      await expect(create({ transactionId: transaction.id, amount: 0 })).rejects.toThrow();

      await expect(create({ transactionId: transaction.id })).resolves.toBeTruthy();
      await expect(
        create({ installmentPlanId: plan.id, strategy: 'FIRST_INSTALLMENTS' }),
      ).resolves.toBeTruthy();
    });

    it('refund_allocations: amount > 0', async () => {
      const { invoice, transaction } = await setup();
      const refund = await db.refund.create({
        data: { transactionId: transaction.id, amount: 500, refundDate: date('2027-10-10') },
      });
      const data = {
        refundId: refund.id,
        transactionId: transaction.id,
        invoiceId: invoice.id,
      };
      await expect(db.refundAllocation.create({ data: { ...data, amount: 0 } })).rejects.toThrow();
      await expect(
        db.refundAllocation.create({ data: { ...data, amount: 500 } }),
      ).resolves.toBeTruthy();
    });
  });
});
