import express, { Router, type Express, type Request, type Response } from 'express';
import cors from 'cors';
import { prisma as defaultPrisma } from './shared/prisma.js';
import { SystemClock } from './shared/clock.js';
import type { AppContext } from './shared/context.js';
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

export const defaultContext = (): AppContext => ({
  prisma: defaultPrisma,
  clock: new SystemClock(),
});

export const createApp = (ctx: AppContext = defaultContext()): Express => {
  const app = express();

  app.use(cors());
  app.use(express.json());

  app.get('/health', (_req: Request, res: Response) => {
    res.status(200).json({
      status: 'ok',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    });
  });

  const api = Router();
  api.use((_req, _res, next) => {
    refreshState(ctx).then(() => next(), next);
  });
  api.use('/categories', categoriesRouter(ctx));
  api.use('/payment-methods', paymentMethodsRouter(ctx));
  api.use('/credit-cards', creditCardsRouter(ctx));
  api.use(invoicesRouter(ctx));
  api.use(refundsRouter(ctx));
  api.use('/transactions', transactionsRouter(ctx));
  api.use('/installment-plans', installmentsRouter(ctx));
  api.use('/recurrences', recurrencesRouter(ctx));
  api.use('/monthly-statement', monthlyStatementRouter(ctx));
  api.use('/financial-periods', periodsRouter(ctx));
  app.use('/api', api);

  app.use(errorHandler);

  return app;
};
