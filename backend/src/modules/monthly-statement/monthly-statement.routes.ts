import { Router } from 'express';
import { z } from 'zod';
import type { AppContext } from '../../shared/context.js';
import { asyncHandler, yearMonthSchema } from '../../shared/http.js';
import { getMonthlyStatement } from './monthly-statement.service.js';

const query = z.object({ month: yearMonthSchema });

export const monthlyStatementRouter = (ctx: AppContext): Router => {
  const router = Router();

  router.get(
    '/',
    asyncHandler(async (req, res) => {
      const { month } = query.parse(req.query);
      res.json(await getMonthlyStatement(ctx, month));
    }),
  );

  return router;
};
