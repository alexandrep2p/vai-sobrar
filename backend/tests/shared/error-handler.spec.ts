import { describe, it, expect, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import { z } from 'zod';
import { BusinessError, BUSINESS_ERROR_CODES, httpStatusFor } from '../../src/shared/errors.js';
import { errorHandler } from '../../src/shared/error-handler.js';

const buildApp = () => {
  const app = express();
  app.use(express.json());
  app.get('/business', () => {
    throw new BusinessError('PERIOD_CLOSED', 'Mês fechado.', { month: '2027-01' });
  });
  app.get('/not-found', () => {
    throw new BusinessError('TRANSACTION_NOT_FOUND');
  });
  app.get('/rule', () => {
    throw new BusinessError('INVALID_PAYMENT_DATE');
  });
  app.post('/zod', (req) => {
    z.object({ name: z.string(), amount: z.number().int() }).parse(req.body);
  });
  app.get('/boom', () => {
    throw new Error('segredo interno');
  });
  app.use(errorHandler);
  return app;
};

describe('errorHandler', () => {
  it('serializa erro de negócio com código, mensagem, detalhes e status', async () => {
    const res = await request(buildApp()).get('/business');
    expect(res.status).toBe(409);
    expect(res.body).toEqual({
      error: { code: 'PERIOD_CLOSED', message: 'Mês fechado.', details: { month: '2027-01' } },
    });
  });

  it('usa 404 para não encontrado e 422 para violação de regra', async () => {
    expect((await request(buildApp()).get('/not-found')).status).toBe(404);
    expect((await request(buildApp()).get('/rule')).status).toBe(422);
  });

  it('serializa erro Zod como VALIDATION_ERROR com 400', async () => {
    const res = await request(buildApp()).post('/zod').send({ amount: 1.5 });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    const paths = res.body.error.details.map((d: { path: string }) => d.path);
    expect(paths).toEqual(expect.arrayContaining(['name', 'amount']));
  });

  it('retorna 400 para JSON malformado', async () => {
    const res = await request(buildApp())
      .post('/zod')
      .set('Content-Type', 'application/json')
      .send('{bad');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_JSON');
  });

  it('não vaza detalhes de erro inesperado', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = await request(buildApp()).get('/boom');
    spy.mockRestore();
    expect(res.status).toBe(500);
    expect(res.body.error.code).toBe('INTERNAL_ERROR');
    expect(JSON.stringify(res.body)).not.toContain('segredo');
  });

  it('todo código tem status HTTP de erro de cliente', () => {
    for (const code of BUSINESS_ERROR_CODES) {
      expect([404, 409, 422]).toContain(httpStatusFor(code));
    }
  });
});
