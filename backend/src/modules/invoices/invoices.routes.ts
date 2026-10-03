import { Router } from 'express';
import { z } from 'zod';
import type { AppContext } from '../../shared/context.js';
import {
  asyncHandler,
  idParams,
  localDateSchema,
  uuidSchema,
  yearMonthSchema,
} from '../../shared/http.js';
import { getInvoice, listCardInvoices, payInvoice } from './invoices.service.js';

const rangeQuery = z.object({
  from: yearMonthSchema.optional(),
  to: yearMonthSchema.optional(),
});
const payBody = z.object({ paid_at: localDateSchema, payment_method_id: uuidSchema }).strict();

/** Rotas de fatura: `GET /credit-cards/:id/invoices`, `GET /invoices/:id`, `POST /invoices/:id/pay`. */
export const invoicesRouter = (ctx: AppContext): Router => {
  const router = Router();

  router.get(
    '/credit-cards/:id/invoices',
    asyncHandler(async (req, res) => {
      const { id } = idParams.parse(req.params);
      const range = rangeQuery.parse(req.query);
      res.json({ data: await listCardInvoices(ctx, id, range) });
    }),
  );

  router.get(
    '/invoices/:id',
    asyncHandler(async (req, res) => {
      const { id } = idParams.parse(req.params);
      res.json(await getInvoice(ctx, id));
    }),
  );

  router.post(
    '/invoices/:id/pay',
    asyncHandler(async (req, res) => {
      const { id } = idParams.parse(req.params);
      const body = payBody.parse(req.body);
      res.json(
        await payInvoice(ctx, id, {
          paidAt: body.paid_at,
          paymentMethodId: body.payment_method_id,
        }),
      );
    }),
  );

  return router;
};
