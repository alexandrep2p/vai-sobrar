import { Router } from 'express';
import { z } from 'zod';
import { ctxOf } from '../../shared/context.js';
import { asyncHandler, dayOfMonthSchema, idParams, nameSchema } from '../../shared/http.js';
import {
  createCreditCard,
  getCreditCard,
  listCreditCards,
  setCreditCardActive,
  updateCreditCard,
} from './credit-cards.service.js';

const createBody = z
  .object({
    name: nameSchema,
    best_purchase_day: dayOfMonthSchema,
    due_day: dayOfMonthSchema,
  })
  .strict();

const updateBody = z
  .object({
    name: nameSchema.optional(),
    best_purchase_day: dayOfMonthSchema.optional(),
    due_day: dayOfMonthSchema.optional(),
  })
  .strict()
  .refine((body) => Object.keys(body).length > 0, { message: 'Informe ao menos um campo.' });

export const creditCardsRouter = (): Router => {
  const router = Router();

  router.get(
    '/',
    asyncHandler(async (req, res) => {
      const ctx = ctxOf(req);
      res.json({ data: await listCreditCards(ctx) });
    }),
  );

  router.get(
    '/:id',
    asyncHandler(async (req, res) => {
      const ctx = ctxOf(req);
      const { id } = idParams.parse(req.params);
      res.json(await getCreditCard(ctx, id));
    }),
  );

  router.post(
    '/',
    asyncHandler(async (req, res) => {
      const ctx = ctxOf(req);
      const body = createBody.parse(req.body);
      res.status(201).json(
        await createCreditCard(ctx, {
          name: body.name,
          bestPurchaseDay: body.best_purchase_day,
          dueDay: body.due_day,
        }),
      );
    }),
  );

  router.put(
    '/:id',
    asyncHandler(async (req, res) => {
      const ctx = ctxOf(req);
      const { id } = idParams.parse(req.params);
      const body = updateBody.parse(req.body);
      res.json(
        await updateCreditCard(ctx, id, {
          name: body.name,
          bestPurchaseDay: body.best_purchase_day,
          dueDay: body.due_day,
        }),
      );
    }),
  );

  router.post(
    '/:id/activate',
    asyncHandler(async (req, res) => {
      const ctx = ctxOf(req);
      const { id } = idParams.parse(req.params);
      res.json(await setCreditCardActive(ctx, id, true));
    }),
  );

  router.post(
    '/:id/deactivate',
    asyncHandler(async (req, res) => {
      const ctx = ctxOf(req);
      const { id } = idParams.parse(req.params);
      res.json(await setCreditCardActive(ctx, id, false));
    }),
  );

  return router;
};
