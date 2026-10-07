import express, { Router, type Express, type Request, type Response } from 'express';
import { prisma as defaultPrisma } from './shared/prisma.js';
import { SystemClock } from './shared/clock.js';
import { ctxOf, type BaseContext } from './shared/context.js';
import { errorHandler } from './shared/error-handler.js';
import { categoriesRouter } from './modules/categories/categories.routes.js';
import { paymentMethodsRouter } from './modules/payment-methods/payment-methods.routes.js';
import { creditCardsRouter } from './modules/credit-cards/credit-cards.routes.js';
import { transactionsRouter } from './modules/transactions/transactions.routes.js';
import { installmentsRouter } from './modules/installments/installments.routes.js';
import { refreshState } from './shared/refresh.js';
import { invoicesRouter } from './modules/invoices/invoices.routes.js';
import { refundsRouter } from './modules/refunds/refunds.routes.js';
import { recurrencesRouter } from './modules/recurrences/recurrences.routes.js';
import { monthlyStatementRouter } from './modules/monthly-statement/monthly-statement.routes.js';
import { periodsRouter } from './modules/financial-periods/periods.routes.js';
import {
  authRouter,
  DEFAULT_AUTH_RATE_LIMIT,
  type AuthRateLimit,
} from './modules/auth/auth.routes.js';
import { requireAuth } from './modules/auth/require-auth.js';

export const defaultContext = (): BaseContext => ({
  prisma: defaultPrisma,
  clock: new SystemClock(),
});

export interface AppOptions {
  /** Limite de tentativas de login/cadastro; `false` desliga (testes). */
  authRateLimit?: AuthRateLimit | false;
}

export const createApp = (
  base: BaseContext = defaultContext(),
  options: AppOptions = {},
): Express => {
  const app = express();

  // Atrás de proxy reverso (produção), o IP real do cliente vem do X-Forwarded-For.
  const trustProxy = process.env['TRUST_PROXY'];
  if (trustProxy) {
    // Número = saltos de proxy; senão, lista de IPs/sub-redes confiáveis (semântica do Express).
    app.set('trust proxy', /^\d+$/.test(trustProxy) ? Number(trustProxy) : trustProxy);
  }
  // Frontend e API na mesma origem (/api por proxy): sem CORS — architecture §22.
  app.use(express.json());

  app.get('/health', (_req: Request, res: Response) => {
    res.status(200).json({
      status: 'ok',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    });
  });

  // Públicas: cadastro e login (as demais rotas de /api/auth exigem sessão por conta própria).
  app.use('/api/auth', authRouter(base, options.authRateLimit ?? DEFAULT_AUTH_RATE_LIMIT));

  // Todo o restante de /api exige sessão; os casos de uso recebem o contexto do usuário (PD-41).
  const api = Router();
  api.use(requireAuth(base));
  api.use((req, _res, next) => {
    refreshState(ctxOf(req)).then(() => next(), next);
  });
  api.use('/categories', categoriesRouter());
  api.use('/payment-methods', paymentMethodsRouter());
  api.use('/credit-cards', creditCardsRouter());
  api.use(invoicesRouter());
  api.use(refundsRouter());
  api.use('/transactions', transactionsRouter());
  api.use('/installment-plans', installmentsRouter());
  api.use('/recurrences', recurrencesRouter());
  api.use('/monthly-statement', monthlyStatementRouter());
  api.use('/financial-periods', periodsRouter());
  app.use('/api', api);

  app.use(errorHandler);

  return app;
};
