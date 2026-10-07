import { Router } from 'express';
import { z } from 'zod';
import { ctxOf } from '../../shared/context.js';
import { asyncHandler, idParams, nameSchema } from '../../shared/http.js';
import {
  createPaymentMethod,
  listPaymentMethods,
  setPaymentMethodActive,
  updatePaymentMethod,
} from './payment-methods.service.js';

// `kind` só aceita STANDARD: cartões são criados pelo fluxo de cartão. `source` não é aceito.
const createBody = z.object({ name: nameSchema, kind: z.literal('STANDARD').optional() }).strict();
const updateBody = z.object({ name: nameSchema }).strict();

export const paymentMethodsRouter = (): Router => {
  const router = Router();

  router.get(
    '/',
    asyncHandler(async (req, res) => {
      const ctx = ctxOf(req);
      res.json({ data: await listPaymentMethods(ctx) });
    }),
  );

  router.post(
    '/',
    asyncHandler(async (req, res) => {
      const ctx = ctxOf(req);
      const body = createBody.parse(req.body);
      res.status(201).json(await createPaymentMethod(ctx, { name: body.name }));
    }),
  );

  router.put(
    '/:id',
    asyncHandler(async (req, res) => {
      const ctx = ctxOf(req);
      const { id } = idParams.parse(req.params);
      res.json(await updatePaymentMethod(ctx, id, updateBody.parse(req.body)));
    }),
  );

  router.post(
    '/:id/activate',
    asyncHandler(async (req, res) => {
      const ctx = ctxOf(req);
      const { id } = idParams.parse(req.params);
      res.json(await setPaymentMethodActive(ctx, id, true));
    }),
  );

  router.post(
    '/:id/deactivate',
    asyncHandler(async (req, res) => {
      const ctx = ctxOf(req);
      const { id } = idParams.parse(req.params);
      res.json(await setPaymentMethodActive(ctx, id, false));
    }),
  );

  return router;
};
