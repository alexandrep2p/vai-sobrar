import { Router } from 'express';
import { z } from 'zod';
import type { AppContext } from '../../shared/context.js';
import { asyncHandler, idParams, nameSchema } from '../../shared/http.js';
import {
  createCategory,
  listCategories,
  setCategoryActive,
  updateCategory,
} from './categories.service.js';

const typeSchema = z.enum(['INCOME', 'EXPENSE']);
const createBody = z.object({ name: nameSchema, type: typeSchema }).strict();
const updateBody = z
  .object({ name: nameSchema.optional(), type: typeSchema.optional() })
  .strict()
  .refine((body) => body.name !== undefined || body.type !== undefined, {
    message: 'Informe name e/ou type.',
  });

export const categoriesRouter = (ctx: AppContext): Router => {
  const router = Router();

  router.get(
    '/',
    asyncHandler(async (_req, res) => {
      res.json({ data: await listCategories(ctx) });
    }),
  );

  router.post(
    '/',
    asyncHandler(async (req, res) => {
      const body = createBody.parse(req.body);
      res.status(201).json(await createCategory(ctx, body));
    }),
  );

  router.put(
    '/:id',
    asyncHandler(async (req, res) => {
      const { id } = idParams.parse(req.params);
      const body = updateBody.parse(req.body);
      res.json(await updateCategory(ctx, id, body));
    }),
  );

  router.post(
    '/:id/activate',
    asyncHandler(async (req, res) => {
      const { id } = idParams.parse(req.params);
      res.json(await setCategoryActive(ctx, id, true));
    }),
  );

  router.post(
    '/:id/deactivate',
    asyncHandler(async (req, res) => {
      const { id } = idParams.parse(req.params);
      res.json(await setCategoryActive(ctx, id, false));
    }),
  );

  return router;
};
