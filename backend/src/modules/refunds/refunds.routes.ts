import { Router } from 'express';
import { z } from 'zod';
import { ctxOf } from '../../shared/context.js';
import {
  asyncHandler,
  idParams,
  localDateSchema,
  positiveCentsSchema,
  uuidSchema,
} from '../../shared/http.js';
import {
  createRefund,
  getRefund,
  listPlanRefunds,
  listTransactionRefunds,
} from './refunds.service.js';

// Exatamente um alvo; `strategy` obrigatória se e somente se o alvo for um plano (refunds.md §4).
const createBody = z
  .object({
    transaction_id: uuidSchema.optional(),
    installment_plan_id: uuidSchema.optional(),
    amount: positiveCentsSchema,
    refund_date: localDateSchema,
    strategy: z.enum(['FIRST_INSTALLMENTS', 'LAST_INSTALLMENTS', 'PROPORTIONAL']).optional(),
  })
  .strict()
  .superRefine((body, ctx) => {
    const hasTx = body.transaction_id !== undefined;
    const hasPlan = body.installment_plan_id !== undefined;
    if (hasTx === hasPlan) {
      ctx.addIssue({
        code: 'custom',
        message: 'Informe exatamente um entre transaction_id e installment_plan_id.',
        path: ['transaction_id'],
      });
    }
    if (hasPlan && body.strategy === undefined) {
      ctx.addIssue({
        code: 'custom',
        message: 'strategy é obrigatória para compra parcelada.',
        path: ['strategy'],
      });
    }
    if (!hasPlan && body.strategy !== undefined) {
      ctx.addIssue({
        code: 'custom',
        message: 'strategy só se aplica a compra parcelada.',
        path: ['strategy'],
      });
    }
  });

export const refundsRouter = (): Router => {
  const router = Router();

  router.post(
    '/refunds',
    asyncHandler(async (req, res) => {
      const ctx = ctxOf(req);
      const b = createBody.parse(req.body);
      res.status(201).json(
        await createRefund(ctx, {
          transactionId: b.transaction_id,
          installmentPlanId: b.installment_plan_id,
          amount: b.amount,
          refundDate: b.refund_date,
          strategy: b.strategy,
        }),
      );
    }),
  );

  router.get(
    '/refunds/:id',
    asyncHandler(async (req, res) => {
      const ctx = ctxOf(req);
      const { id } = idParams.parse(req.params);
      res.json(await getRefund(ctx, id));
    }),
  );

  router.get(
    '/transactions/:id/refunds',
    asyncHandler(async (req, res) => {
      const ctx = ctxOf(req);
      const { id } = idParams.parse(req.params);
      res.json(await listTransactionRefunds(ctx, id));
    }),
  );

  router.get(
    '/installment-plans/:id/refunds',
    asyncHandler(async (req, res) => {
      const ctx = ctxOf(req);
      const { id } = idParams.parse(req.params);
      res.json(await listPlanRefunds(ctx, id));
    }),
  );

  return router;
};
