import type { PaymentMethod, PaymentMethodKind, PaymentMethodSource } from '@prisma/client';
import type { AppContext } from '../../shared/context.js';
import type { Db } from '../../shared/db.js';
import { BusinessError } from '../../shared/errors.js';
import { isUniqueViolation } from '../../shared/prisma-errors.js';
import { generateDueOccurrences } from '../recurrences/occurrences.js';

export interface PaymentMethodDto {
  id: string;
  name: string;
  source: PaymentMethodSource;
  kind: PaymentMethodKind;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export const toPaymentMethodDto = (method: PaymentMethod): PaymentMethodDto => ({
  id: method.id,
  name: method.name,
  source: method.source,
  kind: method.kind,
  active: method.active,
  created_at: method.createdAt.toISOString(),
  updated_at: method.updatedAt.toISOString(),
});

const nameTaken = (): BusinessError =>
  new BusinessError('PAYMENT_METHOD_NAME_TAKEN', 'Já existe um método de pagamento com esse nome.');

export const findPaymentMethodOrThrow = async (db: Db, id: string): Promise<PaymentMethod> => {
  const method = await db.paymentMethod.findUnique({ where: { id } });
  if (!method) {
    throw new BusinessError('PAYMENT_METHOD_NOT_FOUND', 'Método de pagamento não encontrado.');
  }
  return method;
};

/** payment-methods.md §5: nome único entre todos os métodos (comuns e cartões, ativos e inativos). */
export const assertMethodNameAvailable = async (
  db: Db,
  name: string,
  ignoreId?: string,
): Promise<void> => {
  const clash = await db.paymentMethod.findFirst({
    where: {
      name: { equals: name, mode: 'insensitive' },
      ...(ignoreId ? { id: { not: ignoreId } } : {}),
    },
    select: { id: true },
  });
  if (clash) throw nameTaken();
};

export const listPaymentMethods = async ({ prisma }: AppContext): Promise<PaymentMethodDto[]> => {
  const methods = await prisma.paymentMethod.findMany({ orderBy: [{ name: 'asc' }] });
  return methods.map(toPaymentMethodDto);
};

/** O fluxo genérico cria somente métodos `STANDARD` do usuário (payment-methods.md §4). */
export const createPaymentMethod = async (
  { prisma }: AppContext,
  input: { name: string },
): Promise<PaymentMethodDto> => {
  await assertMethodNameAvailable(prisma, input.name);
  try {
    const method = await prisma.paymentMethod.create({
      data: { name: input.name, source: 'USER', kind: 'STANDARD', active: true },
    });
    return toPaymentMethodDto(method);
  } catch (error) {
    if (isUniqueViolation(error)) throw nameTaken();
    throw error;
  }
};

export const updatePaymentMethod = async (
  { prisma }: AppContext,
  id: string,
  input: { name: string },
): Promise<PaymentMethodDto> => {
  const method = await findPaymentMethodOrThrow(prisma, id);
  if (method.source !== 'USER' || method.kind !== 'STANDARD') {
    throw new BusinessError(
      'PAYMENT_METHOD_NOT_EDITABLE',
      method.kind === 'CREDIT_CARD'
        ? 'O nome do cartão é editado pelo fluxo de cartão.'
        : 'Métodos do sistema não podem ser editados.',
    );
  }
  await assertMethodNameAvailable(prisma, input.name, id);
  try {
    return toPaymentMethodDto(
      await prisma.paymentMethod.update({ where: { id }, data: { name: input.name } }),
    );
  } catch (error) {
    if (isUniqueViolation(error)) throw nameTaken();
    throw error;
  }
};

export const setPaymentMethodActive = async (
  ctx: AppContext,
  id: string,
  active: boolean,
): Promise<PaymentMethodDto> => {
  const { prisma } = ctx;
  await findPaymentMethodOrThrow(prisma, id);
  const method = await prisma.paymentMethod.update({ where: { id }, data: { active } });
  // recurrences.md §14: ocorrência com data igual à da reativação volta a ser gerada.
  if (active) await generateDueOccurrences(ctx, { fromToday: true });
  return toPaymentMethodDto(method);
};
