import type { Prisma } from '@prisma/client';
import {
  allocateRefund,
  type RefundStrategy,
  type RefundTarget,
  type RefundTargetItem,
} from '../../domain/refund-allocation.js';
import { recognitionInvoice, validateRefundDate } from '../../domain/refund-recognition.js';
import type { LocalDate } from '../../shared/dates.js';
import {
  fromDbDate,
  lockCard,
  lockPeriodsShared,
  toDbDate,
  TRANSACTION_OPTIONS,
  type Db,
} from '../../shared/db.js';
import type { AppContext } from '../../shared/context.js';
import { BusinessError } from '../../shared/errors.js';
import { cents } from '../../shared/money.js';
import { loadClosedMonths } from '../financial-periods/periods.service.js';
import {
  cardConfigOf,
  ensureInvoice,
  loadCardInvoices,
  toSnapshot,
} from '../invoices/invoice-store.js';
import { tenantIdOf } from '../../shared/tenant.js';

const refundInclude = {
  allocations: {
    orderBy: { createdAt: 'asc' },
    include: { invoice: true, transaction: { include: { installment: true } } },
  },
} satisfies Prisma.RefundInclude;

type RefundRow = Prisma.RefundGetPayload<{ include: typeof refundInclude }>;

export interface RefundDto {
  id: string;
  transaction_id: string | null;
  installment_plan_id: string | null;
  amount: number;
  refund_date: LocalDate;
  strategy: RefundStrategy | null;
  allocations: {
    id: string;
    transaction_id: string;
    installment_number: number | null;
    amount: number;
    invoice_id: string;
    invoice_reference_month: string;
    invoice_due_date: LocalDate;
  }[];
  created_at: string;
}

const toRefundDto = (refund: RefundRow): RefundDto => ({
  id: refund.id,
  transaction_id: refund.transactionId,
  installment_plan_id: refund.installmentPlanId,
  amount: refund.amount,
  refund_date: fromDbDate(refund.refundDate),
  strategy: refund.strategy,
  allocations: refund.allocations.map((a) => ({
    id: a.id,
    transaction_id: a.transactionId,
    installment_number: a.transaction.installment?.number ?? null,
    amount: a.amount,
    invoice_id: a.invoiceId,
    invoice_reference_month: a.invoice.referenceMonth,
    invoice_due_date: fromDbDate(a.invoice.dueDate),
  })),
  created_at: refund.createdAt.toISOString(),
});

export interface RefundInput {
  transactionId?: string | undefined;
  installmentPlanId?: string | undefined;
  amount: number;
  refundDate: LocalDate;
  strategy?: RefundStrategy | undefined;
}

const targetTransactionInclude = {
  invoice: true,
  paymentMethod: { include: { creditCard: true } },
  installment: true,
} satisfies Prisma.TransactionInclude;

type TargetTransaction = Prisma.TransactionGetPayload<{ include: typeof targetTransactionInclude }>;

const allocatedByTransaction = async (
  db: Db,
  transactionIds: readonly string[],
): Promise<Map<string, number>> => {
  const rows = await db.refundAllocation.groupBy({
    by: ['transactionId'],
    where: { transactionId: { in: [...transactionIds] } },
    _sum: { amount: true },
  });
  return new Map(rows.map((r) => [r.transactionId, r._sum.amount ?? 0]));
};

const toItem = (
  t: TargetTransaction,
  number: number,
  allocated: Map<string, number>,
): RefundTargetItem => ({
  transactionId: t.id,
  number,
  originalAmount: cents(t.amount),
  allocatedAmount: cents(allocated.get(t.id) ?? 0),
});

/**
 * refunds.md / architecture §14: valida alvo, data e valor; distribui entre as parcelas
 * (`allocateRefund`); escolhe a fatura de reconhecimento de cada alocação (`recognitionInvoice`);
 * persiste `Refund`, `RefundAllocation` e as faturas criadas — tudo em uma transação.
 */
export const createRefund = async (ctx: AppContext, input: RefundInput): Promise<RefundDto> => {
  const today = ctx.clock.today();
  const hasTransaction = input.transactionId !== undefined;
  const hasPlan = input.installmentPlanId !== undefined;
  if (hasTransaction === hasPlan) {
    throw new RangeError('Informe exatamente um alvo: transaction_id ou installment_plan_id.');
  }
  if (hasPlan !== (input.strategy !== undefined)) {
    throw new RangeError('A estratégia é obrigatória somente para compra parcelada.');
  }

  const refund = await ctx.prisma.$transaction(async (tx) => {
    // Alvo e cartão
    let targets: TargetTransaction[];
    let purchaseDate: LocalDate;
    if (input.transactionId !== undefined) {
      const transaction = await tx.transaction.findUnique({
        where: { id: input.transactionId },
        include: targetTransactionInclude,
      });
      if (!transaction)
        throw new BusinessError('TRANSACTION_NOT_FOUND', 'Lançamento não encontrado.');
      const cardPurchase =
        transaction.origin === 'CREDIT_CARD' ||
        (transaction.origin === 'RECURRENCE' &&
          transaction.paymentMethod.kind === 'CREDIT_CARD' &&
          transaction.invoiceId !== null);
      if (!cardPurchase) {
        throw new BusinessError(
          'REFUND_TARGET_NOT_ALLOWED',
          'Somente compras de cartão (à vista, parcelada ou ocorrência de recorrência com cartão) podem ser estornadas.',
        );
      }
      targets = [transaction];
      purchaseDate = fromDbDate(transaction.purchaseDate as Date);
    } else {
      const plan = await tx.installmentPlan.findUnique({
        where: { id: input.installmentPlanId as string },
        include: {
          installments: {
            orderBy: { number: 'asc' },
            include: { transaction: { include: targetTransactionInclude } },
          },
        },
      });
      if (!plan) {
        throw new BusinessError('INSTALLMENT_PLAN_NOT_FOUND', 'Compra parcelada não encontrada.');
      }
      targets = plan.installments.map((i) => i.transaction);
      purchaseDate = fromDbDate(plan.purchaseDate);
    }

    const first = targets[0];
    const card = first?.paymentMethod.creditCard;
    if (!first || !card) {
      throw new BusinessError('REFUND_TARGET_NOT_ALLOWED', 'O alvo não é uma compra de cartão.');
    }

    await lockCard(tx, card.id);
    await lockPeriodsShared(tx);

    validateRefundDate(purchaseDate, input.refundDate, today);

    // Saldo e distribuição (recarregados sob o lock do cartão: estornos simultâneos serializam)
    const allocated = await allocatedByTransaction(
      tx,
      targets.map((t) => t.id),
    );
    const target: RefundTarget =
      input.transactionId !== undefined
        ? { kind: 'SINGLE', item: toItem(first, 1, allocated) }
        : {
            kind: 'PLAN',
            installments: targets.map((t) => toItem(t, t.installment?.number ?? 1, allocated)),
          };
    const allocations = allocateRefund(target, cents(input.amount), input.strategy);

    // Reconhecimento de cada alocação
    const invoices = await loadCardInvoices(tx, card.id);
    const closed = await loadClosedMonths(tx);
    const byId = new Map(targets.map((t) => [t.id, t]));
    const recognized: {
      userId: string;
      transactionId: string;
      amount: number;
      invoiceId: string;
    }[] = [];
    for (const allocation of allocations) {
      const source = byId.get(allocation.transactionId) as TargetTransaction;
      if (!source.invoice) {
        throw new BusinessError(
          'REFUND_TARGET_NOT_ALLOWED',
          'A compra não está postada em fatura.',
        );
      }
      const choice = recognitionInvoice(
        cardConfigOf(card),
        toSnapshot(source.invoice),
        input.refundDate,
        invoices.map(toSnapshot),
        closed,
        today,
      );
      const invoice = await ensureInvoice(tx, card.id, choice, invoices);
      if (!invoices.some((i) => i.id === invoice.id)) invoices.push(invoice);
      recognized.push({
        userId: tenantIdOf(tx),
        transactionId: allocation.transactionId,
        amount: allocation.amount,
        invoiceId: invoice.id,
      });
    }

    return tx.refund.create({
      data: {
        userId: tenantIdOf(tx),
        transactionId: input.transactionId ?? null,
        installmentPlanId: input.installmentPlanId ?? null,
        amount: input.amount,
        refundDate: toDbDate(input.refundDate),
        strategy: input.strategy ?? null,
        allocations: { create: recognized },
      },
      include: refundInclude,
    });
  }, TRANSACTION_OPTIONS);

  return toRefundDto(refund);
};

export const getRefund = async ({ prisma }: AppContext, id: string): Promise<RefundDto> => {
  const refund = await prisma.refund.findUnique({ where: { id }, include: refundInclude });
  if (!refund) throw new BusinessError('REFUND_NOT_FOUND', 'Estorno não encontrado.');
  return toRefundDto(refund);
};

export type RefundSituation = 'FULLY_REFUNDED' | 'PARTIALLY_REFUNDED' | null;

export interface RefundSummaryDto {
  original_amount: number;
  refunded_amount: number;
  refundable_amount: number;
  /** Situação derivada (domain-model §5): não é persistida. */
  refund_status: RefundSituation;
  data: RefundDto[];
}

const situationOf = (original: number, refunded: number): RefundSituation => {
  if (refunded <= 0) return null;
  return refunded >= original ? 'FULLY_REFUNDED' : 'PARTIALLY_REFUNDED';
};

export const listTransactionRefunds = async (
  { prisma }: AppContext,
  transactionId: string,
): Promise<RefundSummaryDto> => {
  const transaction = await prisma.transaction.findUnique({ where: { id: transactionId } });
  if (!transaction) throw new BusinessError('TRANSACTION_NOT_FOUND', 'Lançamento não encontrado.');
  const [refunds, allocated] = await Promise.all([
    prisma.refund.findMany({
      where: { transactionId },
      include: refundInclude,
      orderBy: { createdAt: 'asc' },
    }),
    allocatedByTransaction(prisma, [transactionId]),
  ]);
  const refunded = allocated.get(transactionId) ?? 0;
  return {
    original_amount: transaction.amount,
    refunded_amount: refunded,
    refundable_amount: transaction.amount - refunded,
    refund_status: situationOf(transaction.amount, refunded),
    data: refunds.map(toRefundDto),
  };
};

export const listPlanRefunds = async (
  { prisma }: AppContext,
  planId: string,
): Promise<RefundSummaryDto> => {
  const plan = await prisma.installmentPlan.findUnique({
    where: { id: planId },
    include: { installments: true },
  });
  if (!plan) {
    throw new BusinessError('INSTALLMENT_PLAN_NOT_FOUND', 'Compra parcelada não encontrada.');
  }
  const [refunds, allocated] = await Promise.all([
    prisma.refund.findMany({
      where: { installmentPlanId: planId },
      include: refundInclude,
      orderBy: { createdAt: 'asc' },
    }),
    allocatedByTransaction(
      prisma,
      plan.installments.map((i) => i.transactionId),
    ),
  ]);
  const refunded = [...allocated.values()].reduce((sum, v) => sum + v, 0);
  return {
    original_amount: plan.totalAmount,
    refunded_amount: refunded,
    refundable_amount: plan.totalAmount - refunded,
    refund_status: situationOf(plan.totalAmount, refunded),
    data: refunds.map(toRefundDto),
  };
};
