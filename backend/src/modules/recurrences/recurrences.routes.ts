import { Router } from 'express';
import { z } from 'zod';
import { ctxOf } from '../../shared/context.js';
import {
  asyncHandler,
  dayOfMonthSchema,
  descriptionSchema,
  idParams,
  localDateSchema,
  positiveCentsSchema,
  uuidSchema,
  yearMonthSchema,
} from '../../shared/http.js';
import { editOccurrence, payOccurrence, skipOccurrence } from './occurrence-actions.service.js';
import {
  cancelRecurrence,
  createRecurrence,
  getRecurrence,
  listRecurrences,
  pauseRecurrence,
  resumeRecurrence,
  updateRecurrence,
} from './recurrences.service.js';

const createBody = z
  .object({
    description: descriptionSchema,
    amount: positiveCentsSchema,
    category_id: uuidSchema,
    payment_method_id: uuidSchema,
    due_day: dayOfMonthSchema,
    start_date: localDateSchema,
    end_date: localDateSchema.optional(),
  })
  .strict();

const updateBody = z
  .object({
    description: descriptionSchema.optional(),
    amount: positiveCentsSchema.optional(),
    category_id: uuidSchema.optional(),
    payment_method_id: uuidSchema.optional(),
    due_day: dayOfMonthSchema.optional(),
    end_date: localDateSchema.nullable().optional(),
  })
  .strict()
  .refine((body) => Object.keys(body).length > 0, { message: 'Informe ao menos um campo.' });

const pauseBody = z
  .object({ paused_from: localDateSchema, paused_until: localDateSchema.optional() })
  .strict();

// Ocorrência: `category_id` é aceito apenas para ser rejeitado (a categoria pertence à recorrência).
const occurrenceEditBody = z
  .object({
    description: descriptionSchema.optional(),
    amount: positiveCentsSchema.optional(),
    due_date: localDateSchema.optional(),
    payment_method_id: uuidSchema.optional(),
    category_id: uuidSchema.optional(),
  })
  .strict()
  .refine((body) => Object.keys(body).length > 0, { message: 'Informe ao menos um campo.' });

const occurrenceParams = z.object({ id: uuidSchema, month: yearMonthSchema });
const payBody = z.object({ paid_at: localDateSchema }).strict();

export const recurrencesRouter = (): Router => {
  const router = Router();

  router.get(
    '/',
    asyncHandler(async (req, res) => {
      const ctx = ctxOf(req);
      res.json({ data: await listRecurrences(ctx) });
    }),
  );

  router.get(
    '/:id',
    asyncHandler(async (req, res) => {
      const ctx = ctxOf(req);
      const { id } = idParams.parse(req.params);
      res.json(await getRecurrence(ctx, id));
    }),
  );

  router.post(
    '/',
    asyncHandler(async (req, res) => {
      const ctx = ctxOf(req);
      const b = createBody.parse(req.body);
      res.status(201).json(
        await createRecurrence(ctx, {
          description: b.description,
          amount: b.amount,
          categoryId: b.category_id,
          paymentMethodId: b.payment_method_id,
          dueDay: b.due_day,
          startDate: b.start_date,
          endDate: b.end_date,
        }),
      );
    }),
  );

  router.put(
    '/:id',
    asyncHandler(async (req, res) => {
      const ctx = ctxOf(req);
      const { id } = idParams.parse(req.params);
      const b = updateBody.parse(req.body);
      res.json(
        await updateRecurrence(ctx, id, {
          description: b.description,
          amount: b.amount,
          categoryId: b.category_id,
          paymentMethodId: b.payment_method_id,
          dueDay: b.due_day,
          endDate: b.end_date,
        }),
      );
    }),
  );

  router.post(
    '/:id/pause',
    asyncHandler(async (req, res) => {
      const ctx = ctxOf(req);
      const { id } = idParams.parse(req.params);
      const b = pauseBody.parse(req.body);
      res.json(
        await pauseRecurrence(ctx, id, { pausedFrom: b.paused_from, pausedUntil: b.paused_until }),
      );
    }),
  );

  router.post(
    '/:id/resume',
    asyncHandler(async (req, res) => {
      const ctx = ctxOf(req);
      const { id } = idParams.parse(req.params);
      res.json(await resumeRecurrence(ctx, id));
    }),
  );

  router.post(
    '/:id/cancel',
    asyncHandler(async (req, res) => {
      const ctx = ctxOf(req);
      const { id } = idParams.parse(req.params);
      res.json(await cancelRecurrence(ctx, id));
    }),
  );

  router.post(
    '/:id/occurrences/:month/skip',
    asyncHandler(async (req, res) => {
      const ctx = ctxOf(req);
      const { id, month } = occurrenceParams.parse(req.params);
      res.json(await skipOccurrence(ctx, id, month));
    }),
  );

  router.put(
    '/:id/occurrences/:month',
    asyncHandler(async (req, res) => {
      const ctx = ctxOf(req);
      const { id, month } = occurrenceParams.parse(req.params);
      const b = occurrenceEditBody.parse(req.body);
      res.json(
        await editOccurrence(ctx, id, month, {
          description: b.description,
          amount: b.amount,
          dueDate: b.due_date,
          paymentMethodId: b.payment_method_id,
          categoryId: b.category_id,
        }),
      );
    }),
  );

  router.post(
    '/:id/occurrences/:month/pay',
    asyncHandler(async (req, res) => {
      const ctx = ctxOf(req);
      const { id, month } = occurrenceParams.parse(req.params);
      const { paid_at } = payBody.parse(req.body);
      res.json(await payOccurrence(ctx, id, month, paid_at));
    }),
  );

  return router;
};
