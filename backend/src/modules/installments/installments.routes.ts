import { Router } from 'express';
import { z } from 'zod';
import type { AppContext } from '../../shared/context.js';
import {
  asyncHandler,
  descriptionSchema,
  idParams,
  localDateSchema,
  positiveCentsSchema,
  uuidSchema,
} from '../../shared/http.js';
import {
  deleteInstallmentPlan,
  getInstallmentPlan,
  updateInstallmentPlan,
} from './installments.service.js';

// Editáveis: descrição, categoria e (PD-36) valor total, quantidade e data da compra; o cartão e
// qualquer outro campo são rejeitados (strict).
const updateBody = z
  .object({
    description: descriptionSchema.optional(),
    category_id: uuidSchema.optional(),
    total_amount: positiveCentsSchema.optional(),
    installment_count: z.number().int().min(2).max(120).optional(),
    purchase_date: localDateSchema.optional(),
  })
  .strict()
  .refine((body) => Object.keys(body).length > 0, { message: 'Informe ao menos um campo.' });

export const installmentsRouter = (ctx: AppContext): Router => {
  const router = Router();

  router.get(
    '/:id',
    asyncHandler(async (req, res) => {
      const { id } = idParams.parse(req.params);
      res.json(await getInstallmentPlan(ctx, id));
    }),
  );

  router.put(
    '/:id',
    asyncHandler(async (req, res) => {
      const { id } = idParams.parse(req.params);
      const body = updateBody.parse(req.body);
      res.json(
        await updateInstallmentPlan(ctx, id, {
          description: body.description,
          categoryId: body.category_id,
          totalAmount: body.total_amount,
          installmentCount: body.installment_count,
          purchaseDate: body.purchase_date,
        }),
      );
    }),
  );

  router.delete(
    '/:id',
    asyncHandler(async (req, res) => {
      const { id } = idParams.parse(req.params);
      await deleteInstallmentPlan(ctx, id);
      res.status(204).end();
    }),
  );

  return router;
};
