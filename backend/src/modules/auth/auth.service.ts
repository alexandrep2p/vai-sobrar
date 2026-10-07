import { Prisma, type User } from '@prisma/client';
import type { BaseContext } from '../../shared/context.js';
import type { Db } from '../../shared/db.js';
import { BusinessError } from '../../shared/errors.js';
import { seedSystemMethods } from '../../shared/seed.js';
import { hashPassword, verifyAgainstDummy, verifyPassword } from './password.js';
import { createSession, hashToken } from './session.js';

export interface UserDto {
  id: string;
  name: string;
  username: string;
  email: string;
}

export const toUserDto = (user: User): UserDto => ({
  id: user.id,
  name: user.name,
  username: user.username,
  email: user.email,
});

const emailTaken = (): BusinessError =>
  new BusinessError('EMAIL_TAKEN', 'Já existe uma conta com esse email.');
const usernameTaken = (): BusinessError =>
  new BusinessError('USERNAME_TAKEN', 'Esse username já está em uso.');

/** Corrida entre a verificação e a gravação: o índice único decide qual campo colidiu. */
const takenFromUniqueViolation = (error: unknown): BusinessError | undefined => {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') {
    return undefined;
  }
  const detail = `${JSON.stringify(error.meta ?? {})} ${error.message}`;
  return detail.includes('email') ? emailTaken() : usernameTaken();
};

/** Username único sem diferenciar maiúsculas (o formato não admite curingas de ILIKE). */
export const assertUsernameAvailable = async (
  db: Db,
  username: string,
  ignoreUserId?: string,
): Promise<void> => {
  const clash = await db.user.findFirst({
    where: {
      username: { equals: username, mode: 'insensitive' },
      ...(ignoreUserId ? { id: { not: ignoreUserId } } : {}),
    },
    select: { id: true },
  });
  if (clash) throw usernameTaken();
};

export interface RegisterInput {
  name: string;
  username: string;
  email: string;
  password: string;
}

/** auth.md §5: cria a conta (com os métodos do sistema) sem abrir sessão. */
export const register = async ({ prisma }: BaseContext, input: RegisterInput): Promise<UserDto> => {
  const passwordHash = await hashPassword(input.password);
  try {
    const user = await prisma.$transaction(async (tx) => {
      if (await tx.user.findFirst({ where: { email: input.email }, select: { id: true } })) {
        throw emailTaken();
      }
      await assertUsernameAvailable(tx, input.username);
      const created = await tx.user.create({
        data: {
          name: input.name,
          username: input.username,
          email: input.email,
          passwordHash,
        },
      });
      // Cada conta recebe os próprios PIX, Dinheiro e Débito (RN-AUTH-08).
      await seedSystemMethods(tx, created.id);
      return created;
    });
    return toUserDto(user);
  } catch (error) {
    throw takenFromUniqueViolation(error) ?? error;
  }
};

/** auth.md §6: email inexistente e senha errada têm a mesma resposta. */
export const login = async (
  { prisma }: BaseContext,
  input: { email: string; password: string },
): Promise<{ user: UserDto; token: string }> => {
  const user = await prisma.user.findFirst({ where: { email: input.email } });
  const valid = user
    ? await verifyPassword(input.password, user.passwordHash)
    : await verifyAgainstDummy(input.password);
  if (!user || !valid) {
    throw new BusinessError('INVALID_CREDENTIALS', 'Email ou senha inválidos.');
  }
  const token = await createSession(prisma, user.id);
  return { user: toUserDto(user), token };
};

/** Encerra somente a sessão do token informado (idempotente). */
export const logout = async ({ prisma }: BaseContext, token: string | undefined): Promise<void> => {
  if (!token) return;
  await prisma.session.deleteMany({ where: { tokenHash: hashToken(token) } });
};
