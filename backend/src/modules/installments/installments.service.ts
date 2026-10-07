import type { Prisma } from '@prisma/client';
import { assertAllowed, canDeletePlan, canEditPlanStructure } from '../../domain/edit-guards.js';
import { splitCents } from '../../domain/split-cents.js';
import { addMonths, type LocalDate, type YearMonth } from '../../shared/dates.js';
import type { AppContext } from '../../shared/context.js';
import {
  fromDbDate,
  lockCard,
  toDbDate,
  TRANSACTION_OPTIONS,
  type Db,
  type Tx,
} from '../../shared/db.js';
import { BusinessError } from '../../shared/errors.js';
import { cents } from '../../shared/money.js';
import {
  invoiceForCycle,
  postingInvoiceFor,
  pruneEmptyInvoices,
} from '../invoices/invoice-store.js';
import { deleteRefundsOf } from '../refunds/refund-cleanup.js';
import { loadClosedMonths } from '../financial-periods/periods.service.js';
import {
  assertWithinRetroactiveWindow,
  updateTransactionInTx,
} from '../transactions/transactions.service.js';
import { transactionInclude } from '../transactions/transaction-dto.js';
import { tenantIdOf } from '../../shared/tenant.js';

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
  const plan = await ctx.prisma.$transaction(async (tx) => {
    await lockCard(tx, input.card.id);
    const created = await tx.installmentPlan.create({
      data: {
        userId: ctx.userId,
        creditCardId: input.card.id,
        totalAmount: input.totalAmount,
        installmentCount: input.installmentCount,
        purchaseDate: toDbDate(input.purchaseDate),
      },
    });
    await insertInstallments(tx, ctx.clock.today(), created.id, input);
    return findPlanOrThrow(tx, created.id);
  }, TRANSACTION_OPTIONS);

  return toPlanDto(plan);
};

/**
 * Cria as parcelas do plano (installments.md §6 e §7): `splitCents`, parcela 1 pela regra de
 * postagem (inclusive compra tardia) e as seguintes nos ciclos seguintes. Exige o lock do cartão.
 */
const insertInstallments = async (
  tx: Tx,
  today: LocalDate,
  planId: string,
  input: CreateInstallmentInput,
): Promise<void> => {
  const amounts = splitCents(cents(input.totalAmount), input.installmentCount);
  let referenceMonth: YearMonth | null = null;
  for (const [index, amount] of amounts.entries()) {
    const invoice =
      referenceMonth === null
        ? await postingInvoiceFor(tx, input.card, input.purchaseDate, today)
        : await invoiceForCycle(tx, input.card, addMonths(referenceMonth, 1), today);
    referenceMonth = invoice.referenceMonth as YearMonth;

    const userId = tenantIdOf(tx);
    const transaction = await tx.transaction.create({
      data: {
        userId,
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
        userId,
        installmentPlanId: planId,
        transactionId: transaction.id,
        number: index + 1,
      },
    });
  }
};

export interface UpdatePlanInput {
  description?: string | undefined;
  categoryId?: string | undefined;
  totalAmount?: number | undefined;
  installmentCount?: number | undefined;
  purchaseDate?: LocalDate | undefined;
}

/**
 * installments.md §8 e §9: descrição e categoria valem para a compra inteira (guarda em
 * domain/edit-guards). Valor total, quantidade e data da compra (PD-36) regeneram as parcelas,
 * de forma atômica, enquanto nenhuma estiver em fatura `PAID` ou mês fechado e sem estorno.
 */
export const updateInstallmentPlan = async (
  ctx: AppContext,
  id: string,
  input: UpdatePlanInput,
): Promise<InstallmentPlanDto> => {
  const structural =
    input.totalAmount !== undefined ||
    input.installmentCount !== undefined ||
    input.purchaseDate !== undefined;

  const plan = await ctx.prisma.$transaction(async (tx) => {
    const head = await findPlanOrThrow(tx, id);
    if (structural) await lockCard(tx, head.creditCardId);
    const current = structural ? await findPlanOrThrow(tx, id) : head;
    const first = current.installments[0];
    if (!first) throw new BusinessError('INSTALLMENT_PLAN_NOT_FOUND', 'Plano sem parcelas.');

    if (input.description !== undefined || input.categoryId !== undefined) {
      await updateTransactionInTx(tx, ctx.clock.today(), first.transactionId, {
        description: input.description,
        categoryId: input.categoryId,
      });
    }
    if (structural) await rebuildPlan(tx, ctx.clock.today(), id, input);
    return findPlanOrThrow(tx, id);
  }, TRANSACTION_OPTIONS);
  return toPlanDto(plan);
};

/** Regenera as parcelas do plano com os novos dados (PD-36). Exige o lock do cartão. */
const rebuildPlan = async (
  tx: Tx,
  today: LocalDate,
  id: string,
  input: UpdatePlanInput,
): Promise<void> => {
  const plan = await findPlanOrThrow(tx, id);
  const first = plan.installments[0]?.transaction;
  if (!first) throw new BusinessError('INSTALLMENT_PLAN_NOT_FOUND', 'Plano sem parcelas.');

  const totalAmount = input.totalAmount ?? plan.totalAmount;
  const installmentCount = input.installmentCount ?? plan.installmentCount;
  const currentDate = fromDbDate(plan.purchaseDate);
  const purchaseDate = input.purchaseDate ?? currentDate;
  if (
    totalAmount === plan.totalAmount &&
    installmentCount === plan.installmentCount &&
    purchaseDate === currentDate
  ) {
    return; // nada estrutural mudou
  }

  const closed = await loadClosedMonths(tx);
  const transactionIds = plan.installments.map((i) => i.transactionId);
  const refunds = await tx.refund.count({
    where: { OR: [{ installmentPlanId: id }, { transactionId: { in: transactionIds } }] },
  });
  assertAllowed(
    canEditPlanStructure({
      installments: plan.installments.map((i) => ({
        monthClosed: closed.has(i.transaction.financialMonth as YearMonth),
        invoicePaid: i.transaction.invoice?.status === 'PAID',
      })),
      hasRefunds: refunds > 0,
    }),
  );
  if (purchaseDate !== currentDate) {
    assertWithinRetroactiveWindow(purchaseDate, today, 'INVALID_PURCHASE_DATE');
  }

  const card = await tx.creditCard.findUniqueOrThrow({ where: { id: plan.creditCardId } });
  const oldInvoiceIds = [
    ...new Set(
      plan.installments.flatMap((i) => (i.transaction.invoiceId ? [i.transaction.invoiceId] : [])),
    ),
  ];

  await tx.installment.deleteMany({ where: { installmentPlanId: id } });
  await tx.transaction.deleteMany({ where: { id: { in: transactionIds } } });
  await tx.installmentPlan.update({
    where: { id },
    data: { totalAmount, installmentCount, purchaseDate: toDbDate(purchaseDate) },
  });
  await insertInstallments(tx, today, id, {
    card,
    description: first.description,
    totalAmount,
    installmentCount,
    purchaseDate,
    categoryId: first.categoryId,
    paymentMethodId: first.paymentMethodId,
  });

  // invoices.md §4: ciclo sem lançamentos nem créditos não fica persistido.
  await pruneEmptyInvoices(tx, oldInvoiceIds);
};

/**
 * Apagar a compra parcelada inteira (PD-38, provisório): plano, parcelas e estornos, de forma
 * atômica. Só sem parcela em mês fechado ou fatura `PAID`; faturas que ficarem vazias são removidas.
 */
export const deleteInstallmentPlan = async (ctx: AppContext, id: string): Promise<void> => {
  await ctx.prisma.$transaction(async (tx) => {
    const head = await findPlanOrThrow(tx, id);
    await lockCard(tx, head.creditCardId);
    const plan = await findPlanOrThrow(tx, id);
    const closed = await loadClosedMonths(tx);
    assertAllowed(
      canDeletePlan(
        plan.installments.map((i) => ({
          monthClosed: closed.has(i.transaction.financialMonth as YearMonth),
          invoicePaid: i.transaction.invoice?.status === 'PAID',
        })),
      ),
    );

    const transactionIds = plan.installments.map((i) => i.transactionId);
    const touchedInvoices = new Set<string>(
      plan.installments.flatMap((i) => (i.transaction.invoiceId ? [i.transaction.invoiceId] : [])),
    );
    for (const invoiceId of await deleteRefundsOf(tx, closed, { transactionIds, planId: id })) {
      touchedInvoices.add(invoiceId);
    }
    await tx.installment.deleteMany({ where: { installmentPlanId: id } });
    await tx.transaction.deleteMany({ where: { id: { in: transactionIds } } });
    await tx.installmentPlan.delete({ where: { id } });
    await pruneEmptyInvoices(tx, touchedInvoices);
  }, TRANSACTION_OPTIONS);
};
