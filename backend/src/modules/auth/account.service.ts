import type { User } from '@prisma/client';
import { tenantContext, type BaseContext } from '../../shared/context.js';
import { lockPeriodsExclusive, TRANSACTION_OPTIONS } from '../../shared/db.js';
import { BusinessError } from '../../shared/errors.js';
import { isUniqueViolation } from '../../shared/prisma-errors.js';
import { watermarkKey } from '../recurrences/occurrences.js';
import { assertUsernameAvailable, toUserDto, type UserDto } from './auth.service.js';
import type { AuthState } from './require-auth.js';
import { hashPassword, verifyPassword } from './password.js';

// Minha conta (auth.md §8).

const assertPassword = async (user: User, password: string): Promise<void> => {
  if (!(await verifyPassword(password, user.passwordHash))) {
    throw new BusinessError('INVALID_CURRENT_PASSWORD', 'Senha atual incorreta.');
  }
};

/** §8.1: somente nome e username; email é imutável. */
export const updateProfile = async (
  { prisma }: BaseContext,
  userId: string,
  input: { name?: string | undefined; username?: string | undefined },
): Promise<UserDto> => {
  try {
    const user = await prisma.$transaction(async (tx) => {
      if (input.username !== undefined) await assertUsernameAvailable(tx, input.username, userId);
      return tx.user.update({
        where: { id: userId },
        data: {
          ...(input.name !== undefined ? { name: input.name } : {}),
          ...(input.username !== undefined ? { username: input.username } : {}),
        },
      });
    });
    return toUserDto(user);
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new BusinessError('USERNAME_TAKEN', 'Esse username já está em uso.');
    }
    throw error;
  }
};

/** §8.2: exige a senha atual e encerra as outras sessões; a sessão atual continua. */
export const changePassword = async (
  { prisma }: BaseContext,
  auth: AuthState,
  input: { currentPassword: string; newPassword: string },
): Promise<void> => {
  await assertPassword(auth.user, input.currentPassword);
  const passwordHash = await hashPassword(input.newPassword);
  await prisma.$transaction([
    prisma.user.update({ where: { id: auth.user.id }, data: { passwordHash } }),
    prisma.session.deleteMany({ where: { userId: auth.user.id, id: { not: auth.sessionId } } }),
  ]);
};

/**
 * §8.3: exige a senha atual e apaga definitivamente o usuário, as sessões e todos os dados
 * financeiros (inclusive meses fechados e faturas pagas), na ordem das dependências.
 */
export const deleteAccount = async (
  base: BaseContext,
  auth: AuthState,
  password: string,
): Promise<void> => {
  await assertPassword(auth.user, password);
  const userId = auth.user.id;
  const { prisma } = tenantContext(base, userId);
  await prisma.$transaction(async (tx) => {
    // Bloqueia escritas concorrentes do próprio usuário que dependem dos meses.
    await lockPeriodsExclusive(tx);
    await tx.refundAllocation.deleteMany({});
    await tx.refund.deleteMany({});
    await tx.installment.deleteMany({});
    await tx.recurrenceException.deleteMany({});
    await tx.invoice.updateMany({ data: { creditTransferredToInvoiceId: null } });
    await tx.transaction.deleteMany({});
    await tx.installmentPlan.deleteMany({});
    await tx.invoice.deleteMany({});
    await tx.recurrence.deleteMany({});
    await tx.creditCard.deleteMany({});
    await tx.paymentMethod.deleteMany({});
    await tx.category.deleteMany({});
    await tx.financialPeriod.deleteMany({});
    await tx.jobState.deleteMany({ where: { key: watermarkKey(userId) } });
    await tx.session.deleteMany({ where: { userId } });
    await tx.user.delete({ where: { id: userId } });
  }, TRANSACTION_OPTIONS);
};
