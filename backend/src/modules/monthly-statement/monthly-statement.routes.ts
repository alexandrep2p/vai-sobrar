import { Router } from 'express';
import { z } from 'zod';
import { ctxOf } from '../../shared/context.js';
import { asyncHandler, yearMonthSchema } from '../../shared/http.js';
import { getMonthlyStatement } from './monthly-statement.service.js';

const query = z.object({ month: yearMonthSchema });

export const monthlyStatementRouter = (): Router => {
  const router = Router();

  router.get(
    '/',
    asyncHandler(async (req, res) => {
      const ctx = ctxOf(req);
      const { month } = query.parse(req.query);
      res.json(await getMonthlyStatement(ctx, month));
    }),
  );

  return router;
};
