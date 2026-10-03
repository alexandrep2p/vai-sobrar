import { Router } from 'express';
import { z } from 'zod';
import type { AppContext } from '../../shared/context.js';
import { asyncHandler, yearMonthSchema } from '../../shared/http.js';
import { closeMonth } from './close-month.service.js';
import { getPeriodState } from './periods.service.js';

const monthParams = z.object({ month: yearMonthSchema });

export const periodsRouter = (ctx: AppContext): Router => {
  const router = Router();

  router.get(
    '/:month',
    asyncHandler(async (req, res) => {
      const { month } = monthParams.parse(req.params);
      res.json(await getPeriodState(ctx, month));
    }),
  );

  router.post(
    '/:month/close',
    asyncHandler(async (req, res) => {
      const { month } = monthParams.parse(req.params);
      res.json(await closeMonth(ctx, month));
    }),
  );

  return router;
};
