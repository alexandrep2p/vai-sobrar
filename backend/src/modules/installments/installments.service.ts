import type { Prisma } from '@prisma/client';
import { splitCents } from '../../domain/split-cents.js';
import { addMonths, type LocalDate, type YearMonth } from '../../shared/dates.js';
import type { AppContext } from '../../shared/context.js';
import { fromDbDate, lockCard, toDbDate, TRANSACTION_OPTIONS, type Db } from '../../shared/db.js';
import { BusinessError } from '../../shared/errors.js';
import { cents } from '../../shared/money.js';
import { invoiceForCycle, postingInvoiceFor } from '../invoices/invoice-store.js';
import { updateTransactionInTx } from '../transactions/transactions.service.js';
import { transactionInclude } from '../transactions/transaction-dto.js';

const planInclude = {
  installments: {
    orderBy: { number: 'asc' },
    include: { transaction: { include: transactionInclude } },
  },
} satisfies Prisma.InstallmentPlanInclude;

type PlanRow = Prisma.InstallmentPlanGetPayload<{ include: typeof planInclude }>;

export interface InstallmentPlanDto {
  id: string;
  credit_card_id: string;
  description: string;
  category: { id: string; name: string; type: 'INCOME' | 'EXPENSE' };
  total_amount: number;
  installment_count: number;
  purchase_date: LocalDate;
  installments: {
    number: number;
    transaction_id: string;
    amount: number;
    status: 'PENDING' | 'PAID';
    financial_month: string;
    due_date: LocalDate;
    invoice: { id: string; reference_month: string; status: 'OPEN' | 'CLOSED' | 'PAID' } | null;
  }[];
  created_at: string;
}

const toPlanDto = (plan: PlanRow): InstallmentPlanDto => {
  const first = plan.installments[0]?.transaction;
  if (!first) throw new BusinessError('INSTALLMENT_PLAN_NOT_FOUND', 'Plano sem parcelas.');
  return {
    id: plan.id,
    credit_card_id: plan.creditCardId,
    description: first.description,
    category: { id: first.category.id, name: first.category.name, type: first.category.type },
    total_amount: plan.totalAmount,
    installment_count: plan.installmentCount,
    purchase_date: fromDbDate(plan.purchaseDate),
    installments: plan.installments.map((i) => ({
      number: i.number,
      transaction_id: i.transactionId,
      amount: i.transaction.amount,
      status: i.transaction.status,
      financial_month: i.transaction.financialMonth,
      due_date: fromDbDate(i.transaction.dueDate),
      invoice: i.transaction.invoice
        ? {
            id: i.transaction.invoice.id,
            reference_month: i.transaction.invoice.referenceMonth,
            status: i.transaction.invoice.status,
          }
        : null,
    })),
    created_at: plan.createdAt.toISOString(),
  };
};

export const findPlanOrThrow = async (db: Db, id: string): Promise<PlanRow> => {
  const plan = await db.installmentPlan.findUnique({ where: { id }, include: planInclude });
  if (!plan) {
    throw new BusinessError('INSTALLMENT_PLAN_NOT_FOUND', 'Compra parcelada não encontrada.');
  }
  return plan;
};

export const getInstallmentPlan = async (
  { prisma }: AppContext,
  id: string,
): Promise<InstallmentPlanDto> => toPlanDto(await findPlanOrThrow(prisma, id));

export interface CreateInstallmentInput {
  card: { id: string; bestPurchaseDay: number; dueDay: number };
  description: string;
  totalAmount: number;
  installmentCount: number;
  purchaseDate: LocalDate;
  categoryId: string;
  paymentMethodId: string;
}

/**
 * installments.md §4 e §7 / architecture §13: criação atômica — plano, `splitCents`, parcela 1
 * pela regra de postagem (inclusive compra tardia), parcelas seguintes nos ciclos seguintes,
 * faturas necessárias, transações e installments. Qualquer falha desfaz tudo.
 */
export const createInstallmentPurchase = async (
  ctx: AppContext,
  input: CreateInstallmentInput,
): Promise<InstallmentPlanDto> => {
  const amounts = splitCents(cents(input.totalAmount), input.installmentCount);

  const plan = await ctx.prisma.$transaction(async (tx) => {
    await lockCard(tx, input.card.id);
    const created = await tx.installmentPlan.create({
      data: {
        creditCardId: input.card.id,
        totalAmount: input.totalAmount,
        installmentCount: input.installmentCount,
        purchaseDate: toDbDate(input.purchaseDate),
      },
    });

    let referenceMonth: YearMonth | null = null;
    for (const [index, amount] of amounts.entries()) {
      const invoice =
        referenceMonth === null
          ? await postingInvoiceFor(tx, input.card, input.purchaseDate, ctx.clock.today())
          : await invoiceForCycle(tx, input.card, addMonths(referenceMonth, 1), ctx.clock.today());
      referenceMonth = invoice.referenceMonth as YearMonth;

      const transaction = await tx.transaction.create({
        data: {
          description: input.description,
          amount,
          financialMonth: invoice.referenceMonth,
          dueDate: invoice.dueDate,
          status: 'PENDING',
          origin: 'INSTALLMENT',
          categoryId: input.categoryId,
          paymentMethodId: input.paymentMethodId,
          purchaseDate: toDbDate(input.purchaseDate),
          invoiceId: invoice.id,
        },
      });
      await tx.installment.create({
        data: {
          installmentPlanId: created.id,
          transactionId: transaction.id,
          number: index + 1,
        },
      });
    }
    return findPlanOrThrow(tx, created.id);
  }, TRANSACTION_OPTIONS);

  return toPlanDto(plan);
};

/**
 * installments.md §9: descrição e categoria valem para a compra inteira e só mudam se todas as
 * parcelas estiverem em meses abertos e em faturas não pagas (guarda em domain/edit-guards).
 */
export const updateInstallmentPlan = async (
  ctx: AppContext,
  id: string,
  input: { description?: string | undefined; categoryId?: string | undefined },
): Promise<InstallmentPlanDto> => {
  const plan = await ctx.prisma.$transaction(async (tx) => {
    const current = await findPlanOrThrow(tx, id);
    const first = current.installments[0];
    if (!first) throw new BusinessError('INSTALLMENT_PLAN_NOT_FOUND', 'Plano sem parcelas.');
    await updateTransactionInTx(tx, ctx.clock.today(), first.transactionId, {
      description: input.description,
      categoryId: input.categoryId,
    });
    return findPlanOrThrow(tx, id);
  }, TRANSACTION_OPTIONS);
  return toPlanDto(plan);
};
