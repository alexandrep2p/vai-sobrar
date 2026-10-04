import { Prisma } from '@prisma/client';

/** Violação de unicidade (P2002), usada para traduzir corridas em erros de negócio. */
export const isUniqueViolation = (error: unknown): boolean =>
  error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
