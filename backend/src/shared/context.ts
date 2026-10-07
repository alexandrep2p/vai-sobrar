import type { PrismaClient } from '@prisma/client';
import type { Request } from 'express';
import type { Clock } from './clock.js';
import { BusinessError } from './errors.js';
import { scopedPrisma } from './tenant.js';

/** Dependências da aplicação, sem usuário (rotinas globais, autenticação). */
export interface BaseContext {
  prisma: PrismaClient;
  clock: Clock;
}

/** Dependências injetadas nos casos de uso: `prisma` restrito ao usuário `userId` (PD-41). */
export interface AppContext extends BaseContext {
  userId: string;
}

export const tenantContext = (base: BaseContext, userId: string): AppContext => ({
  prisma: scopedPrisma(base.prisma, userId),
  clock: base.clock,
  userId,
});

declare module 'express-serve-static-core' {
  interface Request {
    /** Contexto do usuário autenticado, preenchido por `requireAuth`. */
    ctx?: AppContext;
  }
}

/** Contexto do request; só existe depois de `requireAuth`. */
export const ctxOf = (req: Request): AppContext => {
  if (!req.ctx) throw new BusinessError('UNAUTHENTICATED', 'Sessão ausente ou inválida.');
  return req.ctx;
};
