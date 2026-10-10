import type { Prisma } from '@prisma/client';
import {
  assertAllowed,
  canDeleteTransaction,
  canEditField,
  dueDateMoveVerdict,
  paymentMethodChangeVerdict,
  type EditableField,
  type PlanInstallmentState,
  type TransactionEditContext,
} from '../../domain/edit-guards.js';
import {
  compareLocalDates,
  yearMonthOf,
  type LocalDate,
  type YearMonth,
} from '../../shared/dates.js';
import { deleteRefundsOf } from '../refunds/refund-cleanup.js';
import {
  fromDbDate,
  fromDbDateOrNull,
  lockCard,
  lockPeriodsShared,
  lockRecurrence,
  toDbDate,
  TRANSACTION_OPTIONS,
  type Db,
  type Tx,
} from '../../shared/db.js';
import type { AppContext } from '../../shared/context.js';
import { BusinessError } from '../../shared/errors.js';
import { loadClosedMonths } from '../financial-periods/periods.service.js';
import { postingInvoiceFor, pruneEmptyInvoices } from '../invoices/invoice-store.js';
import { createInstallmentPurchase } from '../installments/installments.service.js';
import {
  findTransactionOrThrow,
  toTransactionDto,
  transactionInclude,
  type TransactionDto,
  type TransactionRow,
} from './transaction-dto.js';

export { toTransactionDto, transactionInclude, findTransactionOrThrow };
export type { TransactionDto, TransactionRow };

export interface TransactionFilters {
  month?: YearMonth | undefined;
  status?: 'PENDING' | 'PAID' | undefined;
  origin?: TransactionRow['origin'] | undefined;
  categoryId?: string | undefined;
  paymentMethodId?: string | undefined;
}

export const listTransactions = async (
  { prisma }: AppContext,
  filters: TransactionFilters,
): Promise<TransactionDto[]> => {
  const rows = await prisma.transaction.findMany({
    where: {
      financialMonth: filters.month,
      status: filters.status,
      origin: filters.origin,
      categoryId: filters.categoryId,
      paymentMethodId: filters.paymentMethodId,
    },
    include: transactionInclude,
    orderBy: [{ dueDate: 'asc' }, { createdAt: 'asc' }],
  });
  return rows.map(toTransactionDto);
};

export const getTransaction = async ({ prisma }: AppContext, id: string): Promise<TransactionDto> =>
  toTransactionDto(await findTransactionOrThrow(prisma, id));

// ---------- Validações compartilhadas ----------

const firstDayOfMonth = (date: LocalDate): LocalDate => `${yearMonthOf(date)}-01` as LocalDate;

/** transactions.md §10: retroativo somente dentro do mês corrente (do dia 1 até hoje); futuro livre. */
export const assertWithinRetroactiveWindow = (
  date: LocalDate,
  today: LocalDate,
  code: 'INVALID_DUE_DATE' | 'INVALID_PURCHASE_DATE',
): void => {
  if (compareLocalDates(date, firstDayOfMonth(today)) < 0) {
    throw new BusinessError(code, 'Data retroativa fora do mês corrente.', { date, today });
  }
};

export const loadActiveCategory = async (db: Db, categoryId: string) => {
  const category = await db.category.findUnique({ where: { id: categoryId } });
  if (!category) throw new BusinessError('CATEGORY_NOT_FOUND', 'Categoria não encontrada.');
  if (!category.active) throw new BusinessError('CATEGORY_INACTIVE', 'A categoria está inativa.');
  return category;
};

export const loadActiveMethod = async (db: Db, methodId: string) => {
  const method = await db.paymentMethod.findUnique({
    where: { id: methodId },
    include: { creditCard: true },
  });
  if (!method) {
    throw new BusinessError('PAYMENT_METHOD_NOT_FOUND', 'Método de pagamento não encontrado.');
  }
  if (!method.active) {
    throw new BusinessError(
      method.kind === 'CREDIT_CARD' ? 'CARD_INACTIVE' : 'PAYMENT_METHOD_INACTIVE',
      'O método de pagamento está inativo.',
    );
  }
  return method;
};

/** `paid_at`: não futuro e fora de mês fechado (transactions.md §8.1, invoices.md §9.1). */
export const assertPaidAtValid = (
  paidAt: LocalDate,
  today: LocalDate,
  closedMonths: ReadonlySet<YearMonth>,
): void => {
  if (compareLocalDates(paidAt, today) > 0) {
    throw new BusinessError('INVALID_PAYMENT_DATE', 'A data de pagamento não pode ser futura.');
  }
  if (closedMonths.has(yearMonthOf(paidAt))) {
    throw new BusinessError('INVALID_PAYMENT_DATE', 'A data de pagamento está em mês fechado.');
  }
};

// ---------- Criação ----------

export interface CreateTransactionInput {
  description: string;
  amount: number;
  categoryId: string;
  paymentMethodId: string;
  /** Natureza esperada; se informada, deve coincidir com o tipo da categoria. */
  type?: 'INCOME' | 'EXPENSE' | undefined;
  dueDate?: LocalDate | undefined;
  purchaseDate?: LocalDate | undefined;
  installmentCount?: number | undefined;
}

/**
 * `POST /api/transactions`: lançamento manual (método comum), compra à vista no cartão ou
 * compra parcelada (`installment_count >= 2`).
 */
export const createTransaction = async (
  ctx: AppContext,
  input: CreateTransactionInput,
): Promise<TransactionDto | { installment_plan: unknown }> => {
  const method = await loadActiveMethod(ctx.prisma, input.paymentMethodId);
  const category = await loadActiveCategory(ctx.prisma, input.categoryId);
  if (input.type !== undefined && input.type !== category.type) {
    throw new BusinessError(
      'CATEGORY_TYPE_MISMATCH',
      'O tipo da categoria não corresponde à natureza do lançamento.',
    );
  }

  if (input.installmentCount === 1) {
    throw new BusinessError(
      'INVALID_INSTALLMENT_OPERATION',
      'Compra em 1x é compra à vista: omita installment_count.',
    );
  }
  const installments = input.installmentCount ?? 1;
  if (method.kind === 'CREDIT_CARD') {
    if (!input.purchaseDate) {
      throw new BusinessError('INVALID_PURCHASE_DATE', 'Informe a data da compra (purchase_date).');
    }
    assertWithinRetroactiveWindow(input.purchaseDate, ctx.clock.today(), 'INVALID_PURCHASE_DATE');
    if (!method.creditCard) {
      throw new BusinessError('CARD_NOT_FOUND', 'Cartão não encontrado.');
    }
    if (installments >= 2) {
      return {
        installment_plan: await createInstallmentPurchase(ctx, {
          card: method.creditCard,
          description: input.description,
          totalAmount: input.amount,
          installmentCount: installments,
          purchaseDate: input.purchaseDate,
          categoryId: category.id,
          paymentMethodId: method.id,
        }),
      };
    }
    return createCardPurchase(ctx, {
      card: method.creditCard,
      description: input.description,
      amount: input.amount,
      purchaseDate: input.purchaseDate,
      categoryId: category.id,
      paymentMethodId: method.id,
    });
  }

  if (installments >= 2) {
    throw new BusinessError(
      'INVALID_INSTALLMENT_OPERATION',
      'Parcelamento só é possível em cartão de crédito.',
    );
  }
  if (!input.dueDate) {
    throw new BusinessError('INVALID_DUE_DATE', 'Informe o vencimento (due_date).');
  }
  return createManualTransaction(ctx, {
    description: input.description,
    amount: input.amount,
    dueDate: input.dueDate,
    categoryId: category.id,
    paymentMethodId: method.id,
  });
};

/** Lançamento manual com método comum (transactions.md §10). Rejeita método de cartão. */
export const createManualTransaction = async (
  ctx: AppContext,
  input: {
    description: string;
    amount: number;
    dueDate: LocalDate;
    categoryId: string;
    paymentMethodId: string;
  },
): Promise<TransactionDto> => {
  const method = await loadActiveMethod(ctx.prisma, input.paymentMethodId);
  if (method.kind === 'CREDIT_CARD') {
    throw new BusinessError(
      'INVALID_PURCHASE_DATE',
      'Compras de cartão seguem o fluxo de compra no cartão.',
    );
  }
  const today = ctx.clock.today();
  assertWithinRetroactiveWindow(input.dueDate, today, 'INVALID_DUE_DATE');
  const month = yearMonthOf(input.dueDate);
  // PD-42: PIX/Dinheiro/Débito (métodos do sistema) já saíram da conta; data futura segue em aberto.
  const settled = method.source === 'SYSTEM' && compareLocalDates(input.dueDate, today) <= 0;

  const row = await ctx.prisma.$transaction(async (tx) => {
    await lockPeriodsShared(tx);
    const closed = await loadClosedMonths(tx);
    if (closed.has(month)) {
      throw new BusinessError('PERIOD_CLOSED', `O mês ${month} está fechado.`, { month });
    }
    return tx.transaction.create({
      data: {
        description: input.description,
        amount: input.amount,
        financialMonth: month,
        dueDate: toDbDate(input.dueDate),
        status: settled ? 'PAID' : 'PENDING',
        paidAt: settled ? toDbDate(input.dueDate) : null,
        origin: 'MANUAL',
        userId: ctx.userId,
        categoryId: input.categoryId,
        paymentMethodId: input.paymentMethodId,
      },
      include: transactionInclude,
    });
  }, TRANSACTION_OPTIONS);
  return toTransactionDto(row);
};

/** Compra à vista no cartão (credit-cards.md §7–§9; architecture §11.1). */
export const createCardPurchase = async (
  ctx: AppContext,
  input: {
    card: { id: string; bestPurchaseDay: number; dueDay: number };
    description: string;
    amount: number;
    purchaseDate: LocalDate;
    categoryId: string;
    paymentMethodId: string;
  },
): Promise<TransactionDto> => {
  const row = await ctx.prisma.$transaction(async (tx) => {
    await lockCard(tx, input.card.id);
    const invoice = await postingInvoiceFor(tx, input.card, input.purchaseDate, ctx.clock.today());
    return tx.transaction.create({
      data: {
        description: input.description,
        amount: input.amount,
        financialMonth: invoice.referenceMonth,
        dueDate: invoice.dueDate,
        status: 'PENDING',
        origin: 'CREDIT_CARD',
        userId: ctx.userId,
        categoryId: input.categoryId,
        paymentMethodId: input.paymentMethodId,
        purchaseDate: toDbDate(input.purchaseDate),
        invoiceId: invoice.id,
      },
      include: transactionInclude,
    });
  }, TRANSACTION_OPTIONS);
  return toTransactionDto(row);
};

// ---------- Edição ----------

export interface UpdateTransactionInput {
  description?: string | undefined;
  amount?: number | undefined;
  dueDate?: LocalDate | undefined;
  purchaseDate?: LocalDate | undefined;
  categoryId?: string | undefined;
  paymentMethodId?: string | undefined;
}

export const editContextOf = (
  row: TransactionRow,
  closed: ReadonlySet<YearMonth>,
  plan?: readonly PlanInstallmentState[],
): TransactionEditContext => ({
  origin: row.origin,
  recurrencePaidWithCard: row.paymentMethod.kind === 'CREDIT_CARD',
  monthClosed: closed.has(row.financialMonth as YearMonth),
  invoicePaid: row.invoice?.status === 'PAID',
  ...(plan ? { planInstallments: plan } : {}),
});

const loadPlanState = async (
  tx: Tx,
  planId: string,
  closed: ReadonlySet<YearMonth>,
): Promise<{ states: PlanInstallmentState[]; transactionIds: string[] }> => {
  const installments = await tx.installment.findMany({
    where: { installmentPlanId: planId },
    include: { transaction: { include: { invoice: true } } },
  });
  return {
    states: installments.map((i) => ({
      monthClosed: closed.has(i.transaction.financialMonth as YearMonth),
      invoicePaid: i.transaction.invoice?.status === 'PAID',
    })),
    transactionIds: installments.map((i) => i.transactionId),
  };
};

/**
 * Edição conforme a matriz de transactions.md §12 (domain/edit-guards). Só os campos que
 * realmente mudam passam pelas guardas. Descrição e categoria de parcela valem para o plano todo.
 */
export const updateTransactionInTx = async (
  tx: Tx,
  today: LocalDate,
  id: string,
  input: UpdateTransactionInput,
): Promise<TransactionRow> => {
  await lockPeriodsShared(tx);
  const row = await findTransactionOrThrow(tx, id);
  const closed = await loadClosedMonths(tx);

  const planId = row.installment?.installmentPlanId;
  const plan = planId ? await loadPlanState(tx, planId, closed) : undefined;
  const ctx = editContextOf(row, closed, plan?.states);

  const check = (field: EditableField): void => assertAllowed(canEditField(ctx, field));
  const data: Prisma.TransactionUncheckedUpdateInput = {};
  const sharedWithPlan: Prisma.TransactionUncheckedUpdateInput = {};

  if (input.description !== undefined && input.description !== row.description) {
    check('description');
    data.description = input.description;
    sharedWithPlan.description = input.description;
  }
  if (input.amount !== undefined && input.amount !== row.amount) {
    check('amount');
    data.amount = input.amount;
  }
  if (
    input.purchaseDate !== undefined &&
    input.purchaseDate !== fromDbDateOrNull(row.purchaseDate)
  ) {
    check('purchaseDate');
  }
  if (input.categoryId !== undefined && input.categoryId !== row.categoryId) {
    check('category');
    const category = await loadActiveCategory(tx, input.categoryId);
    if (category.type !== row.category.type) {
      throw new BusinessError(
        'CATEGORY_TYPE_MISMATCH',
        'A nova categoria deve ter o mesmo tipo da atual.',
      );
    }
    data.categoryId = category.id;
    sharedWithPlan.categoryId = category.id;
  }
  if (input.paymentMethodId !== undefined && input.paymentMethodId !== row.paymentMethodId) {
    check('paymentMethod');
    const method = await loadActiveMethod(tx, input.paymentMethodId);
    assertAllowed(
      paymentMethodChangeVerdict(
        row.paymentMethod.kind === 'CREDIT_CARD',
        method.kind === 'CREDIT_CARD',
      ),
    );
    data.paymentMethodId = method.id;
  }
  if (input.dueDate !== undefined && input.dueDate !== fromDbDate(row.dueDate)) {
    check('dueDate');
    assertAllowed(dueDateMoveVerdict(fromDbDate(row.dueDate), input.dueDate, closed));
    data.dueDate = toDbDate(input.dueDate);
    data.financialMonth = yearMonthOf(input.dueDate);
  }

  if (plan && Object.keys(sharedWithPlan).length > 0) {
    await tx.transaction.updateMany({
      where: { id: { in: plan.transactionIds, not: id } },
      data: sharedWithPlan as Prisma.TransactionUpdateManyMutationInput,
    });
  }
  if (Object.keys(data).length === 0) return row;
  return tx.transaction.update({ where: { id }, data, include: transactionInclude });
};

export const updateTransaction = async (
  ctx: AppContext,
  id: string,
  input: UpdateTransactionInput,
): Promise<TransactionDto> => {
  const row = await ctx.prisma.$transaction(
    (tx) => updateTransactionInTx(tx, ctx.clock.today(), id, input),
    TRANSACTION_OPTIONS,
  );
  return toTransactionDto(row);
};

// ---------- Pagamento, estorno de pagamento e exclusão ----------

const isCardPosted = (row: TransactionRow): boolean => row.invoiceId !== null;

export const payTransactionInTx = async (
  tx: Tx,
  today: LocalDate,
  id: string,
  paidAt: LocalDate,
): Promise<TransactionRow> => {
  await lockPeriodsShared(tx);
  const row = await findTransactionOrThrow(tx, id);
  if (isCardPosted(row)) {
    throw new BusinessError(
      'CARD_TRANSACTION_SETTLED_BY_INVOICE',
      'Lançamentos de cartão são liquidados pelo pagamento da fatura.',
    );
  }
  const closed = await loadClosedMonths(tx);
  assertAllowed(canEditField(editContextOf(row, closed), 'status'));
  if (row.status === 'PAID') {
    throw new BusinessError('TRANSACTION_NOT_EDITABLE', 'O lançamento já está pago.');
  }
  assertPaidAtValid(paidAt, today, closed);
  return tx.transaction.update({
    where: { id },
    data: { status: 'PAID', paidAt: toDbDate(paidAt) },
    include: transactionInclude,
  });
};

export const payTransaction = async (
  ctx: AppContext,
  id: string,
  paidAt: LocalDate,
): Promise<TransactionDto> =>
  toTransactionDto(
    await ctx.prisma.$transaction(
      (tx) => payTransactionInTx(tx, ctx.clock.today(), id, paidAt),
      TRANSACTION_OPTIONS,
    ),
  );

export const unpayTransaction = async (ctx: AppContext, id: string): Promise<TransactionDto> => {
  const row = await ctx.prisma.$transaction(async (tx) => {
    await lockPeriodsShared(tx);
    const current = await findTransactionOrThrow(tx, id);
    if (isCardPosted(current)) {
      throw new BusinessError(
        'CARD_TRANSACTION_SETTLED_BY_INVOICE',
        'Lançamentos de cartão não voltam a pendente individualmente.',
      );
    }
    const closed = await loadClosedMonths(tx);
    assertAllowed(canEditField(editContextOf(current, closed), 'status'));
    if (current.status === 'PENDING') {
      throw new BusinessError('TRANSACTION_NOT_EDITABLE', 'O lançamento já está em aberto.');
    }
    return tx.transaction.update({
      where: { id },
      data: { status: 'PENDING', paidAt: null },
      include: transactionInclude,
    });
  }, TRANSACTION_OPTIONS);
  return toTransactionDto(row);
};

/**
 * Apagar (PD-38, provisório): remove o lançamento fisicamente. Compra de cartão leva os estornos
 * junto e a fatura que ficar vazia deixa de existir; ocorrência de recorrência registra a exceção
 * do mês para não ser gerada de novo.
 */
export const deleteTransaction = async (ctx: AppContext, id: string): Promise<void> => {
  await ctx.prisma.$transaction(async (tx) => {
    // Ordem de locks da geração de ocorrências: recorrência → cartão.
    const head = await findTransactionOrThrow(tx, id);
    if (head.recurrenceId) await lockRecurrence(tx, head.recurrenceId);
    if (head.invoice) await lockCard(tx, head.invoice.creditCardId);
    await lockPeriodsShared(tx);

    const row = await findTransactionOrThrow(tx, id);
    const closed = await loadClosedMonths(tx);
    assertAllowed(
      canDeleteTransaction({
        origin: row.origin,
        monthClosed: closed.has(row.financialMonth as YearMonth),
        invoicePaid: row.invoice?.status === 'PAID',
      }),
    );

    const touchedInvoices: string[] = [];
    if (row.invoiceId) {
      touchedInvoices.push(row.invoiceId);
      touchedInvoices.push(...(await deleteRefundsOf(tx, closed, { transactionIds: [id] })));
    }
    await tx.transaction.delete({ where: { id } });
    if (row.recurrenceId && row.occurrenceMonth) {
      await tx.recurrenceException.upsert({
        where: {
          recurrenceId_occurrenceMonth: {
            recurrenceId: row.recurrenceId,
            occurrenceMonth: row.occurrenceMonth,
          },
        },
        create: {
          userId: row.userId,
          recurrenceId: row.recurrenceId,
          occurrenceMonth: row.occurrenceMonth,
        },
        update: {},
      });
    }
    await pruneEmptyInvoices(tx, touchedInvoices);
  }, TRANSACTION_OPTIONS);
};
