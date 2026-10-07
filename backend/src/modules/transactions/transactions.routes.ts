import { Router } from 'express';
import { z } from 'zod';
import { ctxOf } from '../../shared/context.js';
import {
  asyncHandler,
  descriptionSchema,
  idParams,
  localDateSchema,
  positiveCentsSchema,
  uuidSchema,
  yearMonthSchema,
} from '../../shared/http.js';
import {
  createTransaction,
  deleteTransaction,
  getTransaction,
  listTransactions,
  payTransaction,
  unpayTransaction,
  updateTransaction,
} from './transactions.service.js';

const createBody = z
  .object({
    description: descriptionSchema,
    amount: positiveCentsSchema,
    category_id: uuidSchema,
    payment_method_id: uuidSchema,
    type: z.enum(['INCOME', 'EXPENSE']).optional(),
    due_date: localDateSchema.optional(),
    purchase_date: localDateSchema.optional(),
    installment_count: z.number().int().min(1).max(120).optional(),
  })
  .strict();

// `purchase_date` é aceito apenas para ser rejeitado pela matriz de edição (imutável).
const updateBody = z
  .object({
    description: descriptionSchema.optional(),
    amount: positiveCentsSchema.optional(),
    due_date: localDateSchema.optional(),
    purchase_date: localDateSchema.optional(),
    category_id: uuidSchema.optional(),
    payment_method_id: uuidSchema.optional(),
  })
  .strict()
  .refine((body) => Object.keys(body).length > 0, { message: 'Informe ao menos um campo.' });

const payBody = z.object({ paid_at: localDateSchema }).strict();

const listQuery = z.object({
  month: yearMonthSchema.optional(),
  status: z.enum(['PENDING', 'PAID']).optional(),
  origin: z.enum(['MANUAL', 'CREDIT_CARD', 'INSTALLMENT', 'RECURRENCE']).optional(),
  category_id: uuidSchema.optional(),
  payment_method_id: uuidSchema.optional(),
});

export const transactionsRouter = (): Router => {
  const router = Router();

  router.get(
    '/',
    asyncHandler(async (req, res) => {
      const ctx = ctxOf(req);
      const q = listQuery.parse(req.query);
      res.json({
        data: await listTransactions(ctx, {
          month: q.month,
          status: q.status,
          origin: q.origin,
          categoryId: q.category_id,
          paymentMethodId: q.payment_method_id,
        }),
      });
    }),
  );

  router.get(
    '/:id',
    asyncHandler(async (req, res) => {
      const ctx = ctxOf(req);
      const { id } = idParams.parse(req.params);
      res.json(await getTransaction(ctx, id));
    }),
  );

  router.post(
    '/',
    asyncHandler(async (req, res) => {
      const ctx = ctxOf(req);
      const b = createBody.parse(req.body);
      const result = await createTransaction(ctx, {
        description: b.description,
        amount: b.amount,
        categoryId: b.category_id,
        paymentMethodId: b.payment_method_id,
        type: b.type,
        dueDate: b.due_date,
        purchaseDate: b.purchase_date,
        installmentCount: b.installment_count,
      });
      res.status(201).json(result);
    }),
  );

  router.put(
    '/:id',
    asyncHandler(async (req, res) => {
      const ctx = ctxOf(req);
      const { id } = idParams.parse(req.params);
      const b = updateBody.parse(req.body);
      res.json(
        await updateTransaction(ctx, id, {
          description: b.description,
          amount: b.amount,
          dueDate: b.due_date,
          purchaseDate: b.purchase_date,
          categoryId: b.category_id,
          paymentMethodId: b.payment_method_id,
        }),
      );
    }),
  );

  router.post(
    '/:id/pay',
    asyncHandler(async (req, res) => {
      const ctx = ctxOf(req);
      const { id } = idParams.parse(req.params);
      const { paid_at } = payBody.parse(req.body);
      res.json(await payTransaction(ctx, id, paid_at));
    }),
  );

  router.post(
    '/:id/unpay',
    asyncHandler(async (req, res) => {
      const ctx = ctxOf(req);
      const { id } = idParams.parse(req.params);
      res.json(await unpayTransaction(ctx, id));
    }),
  );

  router.delete(
    '/:id',
    asyncHandler(async (req, res) => {
      const ctx = ctxOf(req);
      const { id } = idParams.parse(req.params);
      await deleteTransaction(ctx, id);
      res.status(204).end();
    }),
  );

  return router;
};
