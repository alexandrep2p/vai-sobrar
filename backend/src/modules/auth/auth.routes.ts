import { Router, type RequestHandler } from 'express';
import { rateLimit } from 'express-rate-limit';
import type { BaseContext } from '../../shared/context.js';
import { BusinessError } from '../../shared/errors.js';
import { asyncHandler } from '../../shared/http.js';
import { changePassword, deleteAccount, updateProfile } from './account.service.js';
import {
  changePasswordBody,
  deleteAccountBody,
  loginBody,
  registerBody,
  updateProfileBody,
} from './auth.schemas.js';
import { login, logout, register, toUserDto } from './auth.service.js';
import { authOf, requireAuth } from './require-auth.js';
import { clearSessionCookie, readSessionToken, setSessionCookie } from './session.js';

export interface AuthRateLimit {
  /** Tentativas malsucedidas aceitas por IP dentro da janela. */
  limit: number;
  windowMs: number;
}

/**
 * architecture §22: 10 tentativas malsucedidas a cada 15 minutos por IP, contadas juntas para
 * login, cadastro e as ações que conferem a senha atual (trocar senha, excluir conta).
 */
export const DEFAULT_AUTH_RATE_LIMIT: AuthRateLimit = { limit: 10, windowMs: 15 * 60 * 1000 };

const attemptsLimiter = ({ limit, windowMs }: AuthRateLimit): RequestHandler =>
  rateLimit({
    windowMs,
    limit,
    skipSuccessfulRequests: true,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    handler: (_req, _res, next) => {
      next(
        new BusinessError(
          'TOO_MANY_ATTEMPTS',
          'Muitas tentativas. Aguarde alguns minutos e tente novamente.',
        ),
      );
    },
  });

export const authRouter = (ctx: BaseContext, rateLimitConfig: AuthRateLimit | false): Router => {
  const router = Router();
  const limited: RequestHandler[] = rateLimitConfig ? [attemptsLimiter(rateLimitConfig)] : [];

  router.post(
    '/register',
    ...limited,
    asyncHandler(async (req, res) => {
      const body = registerBody.parse(req.body);
      res.status(201).json(await register(ctx, body));
    }),
  );

  router.post(
    '/login',
    ...limited,
    asyncHandler(async (req, res) => {
      const body = loginBody.parse(req.body);
      const { user, token } = await login(ctx, body);
      setSessionCookie(res, token);
      res.json(user);
    }),
  );

  router.post(
    '/logout',
    asyncHandler(async (req, res) => {
      await logout(ctx, readSessionToken(req));
      clearSessionCookie(res);
      res.status(204).end();
    }),
  );

  router.get(
    '/me',
    requireAuth(ctx),
    asyncHandler(async (req, res) => {
      res.json(toUserDto(authOf(req).user));
    }),
  );

  router.put(
    '/me',
    requireAuth(ctx),
    asyncHandler(async (req, res) => {
      const body = updateProfileBody.parse(req.body);
      res.json(await updateProfile(ctx, authOf(req).user.id, body));
    }),
  );

  router.post(
    '/me/password',
    requireAuth(ctx),
    ...limited,
    asyncHandler(async (req, res) => {
      const body = changePasswordBody.parse(req.body);
      await changePassword(ctx, authOf(req), {
        currentPassword: body.current_password,
        newPassword: body.new_password,
      });
      res.status(204).end();
    }),
  );

  router.delete(
    '/me',
    requireAuth(ctx),
    ...limited,
    asyncHandler(async (req, res) => {
      const { password } = deleteAccountBody.parse(req.body);
      await deleteAccount(ctx, authOf(req), password);
      clearSessionCookie(res);
      res.status(204).end();
    }),
  );

  return router;
};
