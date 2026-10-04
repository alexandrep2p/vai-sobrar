import request from 'supertest';
import type { Express } from 'express';
import { createApp } from '../../src/app.js';
import { FixedClock } from '../../src/shared/clock.js';
import { parseLocalDate } from '../../src/shared/dates.js';
import { seedSystemMethods } from '../../src/shared/seed.js';
import { prisma, resetDatabase } from '../integration/db.js';

export { prisma };

export interface TestEnv {
  app: Express;
  clock: FixedClock;
  /** Reconstrói o app (mesmo banco, mesmo relógio) — simula reinício do servidor. */
  req: () => request.Agent;
}

/** Banco limpo + métodos do sistema + relógio fixo. */
export const setupEnv = async (today = '2027-10-01'): Promise<TestEnv> => {
  await resetDatabase();
  await seedSystemMethods(prisma);
  const clock = new FixedClock(parseLocalDate(today));
  const app = createApp({ prisma, clock });
  return { app, clock, req: () => request.agent(app) };
};

type Body = Record<string, unknown>;

export class Api {
  constructor(private readonly env: TestEnv) {}

  get = (path: string) => request(this.env.app).get(path);
  post = (path: string, body: Body = {}) => request(this.env.app).post(path).send(body);
  put = (path: string, body: Body = {}) => request(this.env.app).put(path).send(body);
  delete = (path: string) => request(this.env.app).delete(path);

  async category(name: string, type: 'INCOME' | 'EXPENSE' = 'EXPENSE'): Promise<string> {
    const res = await this.post('/api/categories', { name, type });
    if (res.status !== 201) throw new Error(`categoria: ${res.status} ${JSON.stringify(res.body)}`);
    return res.body.id as string;
  }

  async method(name: string): Promise<string> {
    const res = await this.post('/api/payment-methods', { name });
    if (res.status !== 201) throw new Error(`método: ${res.status} ${JSON.stringify(res.body)}`);
    return res.body.id as string;
  }

  /** Métodos do sistema pelo nome (PIX, Dinheiro, Débito). */
  async systemMethod(name: string): Promise<string> {
    const res = await this.get('/api/payment-methods');
    const found = (res.body.data as { id: string; name: string }[]).find((m) => m.name === name);
    if (!found) throw new Error(`método do sistema ausente: ${name}`);
    return found.id;
  }

  /** Cria um cartão; retorna os ids do cartão e do método de pagamento. */
  async card(
    name = 'Nubank',
    bestPurchaseDay = 6,
    dueDay = 15,
  ): Promise<{ cardId: string; methodId: string }> {
    const res = await this.post('/api/credit-cards', {
      name,
      best_purchase_day: bestPurchaseDay,
      due_day: dueDay,
    });
    if (res.status !== 201) throw new Error(`cartão: ${res.status} ${JSON.stringify(res.body)}`);
    return { cardId: res.body.id as string, methodId: res.body.payment_method_id as string };
  }
}
