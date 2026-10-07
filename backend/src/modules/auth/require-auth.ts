import type { Request, RequestHandler } from 'express';
import type { User } from '@prisma/client';
import { tenantContext, type BaseContext } from '../../shared/context.js';
import { BusinessError } from '../../shared/errors.js';
import {
  hashToken,
  readSessionToken,
  SESSION_RENEW_AFTER_MS,
  setSessionCookie,
} from './session.js';

export interface AuthState {
  user: User;
  sessionId: string;
}

declare module 'express-serve-static-core' {
  interface Request {
    /** Preenchido por `requireAuth`. */
    auth?: AuthState;
  }
}

const unauthenticated = (): BusinessError =>
  new BusinessError('UNAUTHENTICATED', 'Sessão ausente ou inválida.');

/** Usuário autenticado do request; só deve ser usado depois de `requireAuth`. */
export const authOf = (req: Request): AuthState => {
  if (!req.auth) throw unauthenticated();
  return req.auth;
};

/**
 * Exige sessão válida (auth.md §9): sem cookie, cookie desconhecido ou sessão encerrada → 401.
 * Renova `last_used_at` e o cookie no máximo uma vez a cada 24 h. Preenche `req.auth` e o
 * contexto restrito ao usuário (`req.ctx`).
 */
export const requireAuth =
  (base: BaseContext): RequestHandler =>
  (req, res, next) => {
    const token = readSessionToken(req);
    if (!token) {
      next(unauthenticated());
      return;
    }
    const { prisma } = base;
    const run = async (): Promise<void> => {
      const session = await prisma.session.findUnique({
        where: { tokenHash: hashToken(token) },
        include: { user: true },
      });
      if (!session) throw unauthenticated();
      if (Date.now() - session.lastUsedAt.getTime() >= SESSION_RENEW_AFTER_MS) {
        await prisma.session.updateMany({
          where: { id: session.id },
          data: { lastUsedAt: new Date() },
        });
        setSessionCookie(res, token);
      }
      req.auth = { user: session.user, sessionId: session.id };
      req.ctx = tenantContext(base, session.user.id);
    };
    run().then(() => next(), next);
  };
