import { Router } from 'express';
import { z } from 'zod';
import type { AppContext } from '../../shared/context.js';
import { asyncHandler, descriptionSchema, idParams, uuidSchema } from '../../shared/http.js';
import { getInstallmentPlan, updateInstallmentPlan } from './installments.service.js';

// Somente descrição e categoria são editáveis; qualquer outro campo é rejeitado (strict).
const updateBody = z
  .object({ description: descriptionSchema.optional(), category_id: uuidSchema.optional() })
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
        }),
      );
    }),
  );

  return router;
};
