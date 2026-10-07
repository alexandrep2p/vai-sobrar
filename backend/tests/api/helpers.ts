import request from 'supertest';
import type { Express } from 'express';
import { createApp } from '../../src/app.js';
import { hashPassword } from '../../src/modules/auth/password.js';
import { createSession } from '../../src/modules/auth/session.js';
import { FixedClock } from '../../src/shared/clock.js';
import { tenantContext, type AppContext } from '../../src/shared/context.js';
import { parseLocalDate } from '../../src/shared/dates.js';
import { seedSystemMethods } from '../../src/shared/seed.js';
import { prisma, resetDatabase } from '../integration/db.js';

export { prisma };

/** Senha dos usuários de teste. */
export const TEST_PASSWORD = 'teste123!';

// O hash (scrypt) é caro: calculado uma vez por processo.
let passwordHash: Promise<string> | undefined;

export interface TestUser {
  userId: string;
  /** Cabeçalho `Cookie` com a sessão do usuário. */
  cookie: string;
  /** Contexto restrito ao usuário (mesmo relógio do ambiente). */
  ctx: AppContext;
}

export interface TestEnv extends TestUser {
  app: Express;
  clock: FixedClock;
  /** Reconstrói o app (mesmo banco, mesmo relógio) — simula reinício do servidor. */
  req: () => request.Agent;
  /** Cria outro usuário (com métodos do sistema e sessão) no mesmo app. */
  addUser: (username: string) => Promise<TestUser>;
}

/** Cria a conta diretamente no banco (como o cadastro: com os métodos do sistema) e uma sessão. */
const createTestUser = async (clock: FixedClock, username: string): Promise<TestUser> => {
  passwordHash ??= hashPassword(TEST_PASSWORD);
  const user = await prisma.user.create({
    data: {
      name: `Teste ${username}`,
      username,
      email: `${username.toLowerCase()}@teste.com`,
      passwordHash: await passwordHash,
    },
  });
  await seedSystemMethods(prisma, user.id);
  const token = await createSession(prisma, user.id);
  return {
    userId: user.id,
    cookie: `vs_session=${token}`,
    ctx: tenantContext({ prisma, clock }, user.id),
  };
};

/** Banco limpo + usuário autenticado (com métodos do sistema) + relógio fixo. */
export const setupEnv = async (today = '2027-10-01'): Promise<TestEnv> => {
  await resetDatabase();
  const clock = new FixedClock(parseLocalDate(today));
  const app = createApp({ prisma, clock }, { authRateLimit: false });
  const user = await createTestUser(clock, 'usuario');
  return {
    ...user,
    app,
    clock,
    req: () => request.agent(app).set('Cookie', user.cookie),
    addUser: (username) => createTestUser(clock, username),
  };
};

type Body = Record<string, unknown>;

/** Cliente da API autenticado como o usuário do ambiente (ou outro, via `user`). */
export class Api {
  private readonly cookie: string;

  constructor(
    private readonly env: TestEnv,
    user: TestUser = env,
  ) {
    this.cookie = user.cookie;
  }

  get = (path: string) => request(this.env.app).get(path).set('Cookie', this.cookie);
  post = (path: string, body: Body = {}) =>
    request(this.env.app).post(path).set('Cookie', this.cookie).send(body);
  put = (path: string, body: Body = {}) =>
    request(this.env.app).put(path).set('Cookie', this.cookie).send(body);
  delete = (path: string) => request(this.env.app).delete(path).set('Cookie', this.cookie);

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
