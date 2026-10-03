import type { CreditCard, PaymentMethod } from '@prisma/client';
import type { AppContext } from '../../shared/context.js';
import { TRANSACTION_OPTIONS, type Db } from '../../shared/db.js';
import { BusinessError } from '../../shared/errors.js';
import { isUniqueViolation } from '../../shared/prisma-errors.js';
import { generateDueOccurrences } from '../recurrences/occurrences.js';
import { assertMethodNameAvailable } from '../payment-methods/payment-methods.service.js';

export type CreditCardWithMethod = CreditCard & { paymentMethod: PaymentMethod };

export interface CreditCardDto {
  id: string;
  payment_method_id: string;
  name: string;
  active: boolean;
  best_purchase_day: number;
  due_day: number;
  created_at: string;
  updated_at: string;
}

export const toCreditCardDto = (card: CreditCardWithMethod): CreditCardDto => ({
  id: card.id,
  payment_method_id: card.paymentMethodId,
  name: card.paymentMethod.name,
  active: card.paymentMethod.active,
  best_purchase_day: card.bestPurchaseDay,
  due_day: card.dueDay,
  created_at: card.createdAt.toISOString(),
  updated_at: card.updatedAt.toISOString(),
});

export const findCardOrThrow = async (db: Db, id: string): Promise<CreditCardWithMethod> => {
  const card = await db.creditCard.findUnique({ where: { id }, include: { paymentMethod: true } });
  if (!card) throw new BusinessError('CARD_NOT_FOUND', 'Cartão não encontrado.');
  return card;
};

/** Cartão associado ao método de pagamento (que deve ser do tipo `CREDIT_CARD`). */
export const findCardByMethod = async (
  db: Db,
  paymentMethodId: string,
): Promise<CreditCardWithMethod | null> =>
  db.creditCard.findUnique({ where: { paymentMethodId }, include: { paymentMethod: true } });

export const listCreditCards = async ({ prisma }: AppContext): Promise<CreditCardDto[]> => {
  const cards = await prisma.creditCard.findMany({
    include: { paymentMethod: true },
    orderBy: { paymentMethod: { name: 'asc' } },
  });
  return cards.map(toCreditCardDto);
};

export const getCreditCard = async ({ prisma }: AppContext, id: string): Promise<CreditCardDto> =>
  toCreditCardDto(await findCardOrThrow(prisma, id));

/** credit-cards.md §3: `PaymentMethod` (CREDIT_CARD, USER, ativo) + `CreditCard` na mesma operação. */
export const createCreditCard = async (
  { prisma }: AppContext,
  input: { name: string; bestPurchaseDay: number; dueDay: number },
): Promise<CreditCardDto> => {
  try {
    const card = await prisma.$transaction(async (tx) => {
      await assertMethodNameAvailable(tx, input.name);
      const method = await tx.paymentMethod.create({
        data: { name: input.name, source: 'USER', kind: 'CREDIT_CARD', active: true },
      });
      return tx.creditCard.create({
        data: {
          paymentMethodId: method.id,
          bestPurchaseDay: input.bestPurchaseDay,
          dueDay: input.dueDay,
        },
        include: { paymentMethod: true },
      });
    }, TRANSACTION_OPTIONS);
    return toCreditCardDto(card);
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new BusinessError('PAYMENT_METHOD_NAME_TAKEN', 'Já existe um método com esse nome.');
    }
    throw error;
  }
};

/**
 * Altera nome, melhor dia e vencimento. Só a configuração vigente muda: faturas persistidas
 * mantêm `closing_date`/`due_date` (credit-cards.md §12).
 */
export const updateCreditCard = async (
  { prisma }: AppContext,
  id: string,
  input: {
    name?: string | undefined;
    bestPurchaseDay?: number | undefined;
    dueDay?: number | undefined;
  },
): Promise<CreditCardDto> => {
  const updated = await prisma.$transaction(async (tx) => {
    const card = await findCardOrThrow(tx, id);
    if (input.name !== undefined) {
      await assertMethodNameAvailable(tx, input.name, card.paymentMethodId);
      await tx.paymentMethod.update({
        where: { id: card.paymentMethodId },
        data: { name: input.name },
      });
    }
    return tx.creditCard.update({
      where: { id },
      data: { bestPurchaseDay: input.bestPurchaseDay, dueDay: input.dueDay },
      include: { paymentMethod: true },
    });
  }, TRANSACTION_OPTIONS);
  return toCreditCardDto(updated);
};

export const setCreditCardActive = async (
  ctx: AppContext,
  id: string,
  active: boolean,
): Promise<CreditCardDto> => {
  const { prisma } = ctx;
  const card = await findCardOrThrow(prisma, id);
  await prisma.paymentMethod.update({ where: { id: card.paymentMethodId }, data: { active } });
  if (active) await generateDueOccurrences(ctx, { fromToday: true });
  return toCreditCardDto(await findCardOrThrow(prisma, id));
};
