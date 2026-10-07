import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { hashToken } from '../../src/modules/auth/session.js';
import { prisma, setupEnv, type TestEnv } from './helpers.js';

let env: TestEnv;

beforeEach(async () => {
  env = await setupEnv();
});
afterAll(() => prisma.$disconnect());

const valid = {
  name: 'Ana Souza',
  username: 'Ana.Souza',
  email: 'Ana@Example.com',
  password: 'abc123!@',
};

const register = (body: Record<string, unknown> = valid) =>
  request(env.app).post('/api/auth/register').send(body);

const login = (email = valid.email, password = valid.password) =>
  request(env.app).post('/api/auth/login').send({ email, password });

/** Valor do cookie de sessão (`vs_session=...`) do Set-Cookie da resposta. */
const sessionCookie = (res: request.Response): string => {
  const raw = res.headers['set-cookie'] as unknown as string[] | undefined;
  const cookie = raw?.find((c) => c.startsWith('vs_session='));
  if (!cookie) throw new Error('sem cookie de sessão');
  return cookie.split(';')[0]!;
};

const loggedIn = async (): Promise<string> => {
  await register();
  return sessionCookie(await login());
};

describe('cadastro (auth.md §4–§5)', () => {
  it('CA-AUTH-01: cria a conta sem abrir sessão; email gravado em minúsculas', async () => {
    const res = await register();
    expect(res.status).toBe(201);
    expect(res.body).toEqual({
      id: expect.any(String),
      name: 'Ana Souza',
      username: 'Ana.Souza',
      email: 'ana@example.com',
    });
    expect(res.headers['set-cookie']).toBeUndefined();
    const user = await prisma.user.findUniqueOrThrow({ where: { id: res.body.id } });
    expect(user.passwordHash).not.toContain(valid.password);
    expect(user.passwordHash.startsWith('scrypt$')).toBe(true);
  });

  it('nome: remove espaços nas pontas e colapsa repetidos', async () => {
    const res = await register({ ...valid, name: '  Carlos   de  Abreu ' });
    expect(res.status).toBe(201);
    expect(res.body.name).toBe('Carlos de Abreu');
  });

  it.each([
    ['nome com uma palavra', { name: 'Carlos' }],
    ['nome vazio', { name: '   ' }],
    ['nome acima de 100', { name: `Carlos ${'a'.repeat(100)}` }],
    ['username curto', { username: 'ab' }],
    ['username longo', { username: 'a'.repeat(31) }],
    ['username com _', { username: 'carlos_abreu' }],
    ['username com acento', { username: 'joão' }],
    ['email inválido', { email: 'ana@' }],
    ['senha curta', { password: 'ab1!' }],
    ['senha sem letra', { password: '12345678!' }],
    ['senha sem número', { password: 'abcdefgh!' }],
    ['senha sem especial', { password: 'abcd1234' }],
    ['senha com acento/espaço como único "especial"', { password: 'abcd 123é' }],
    ['senha acima de 128', { password: `a1!${'x'.repeat(126)}` }],
    ['campo desconhecido', { confirmation: 'x' }],
  ])('CA-AUTH-02..04: rejeita %s', async (_label, patch) => {
    const res = await register({ ...valid, ...patch });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('aceita username com ".", "-", maiúsculas e números; senha com espaço e acento', async () => {
    const res = await register({
      ...valid,
      username: 'A-b.C9',
      password: 'Sé nha 1~',
    });
    expect(res.status).toBe(201);
  });

  it('CA-AUTH-05: email e username únicos sem diferenciar maiúsculas', async () => {
    await register();
    const email = await register({ ...valid, username: 'outro', email: 'ANA@example.COM' });
    expect(email.status).toBe(409);
    expect(email.body.error.code).toBe('EMAIL_TAKEN');
    const username = await register({ ...valid, username: 'ana.souza', email: 'b@x.com' });
    expect(username.status).toBe(409);
    expect(username.body.error.code).toBe('USERNAME_TAKEN');
  });
});

describe('login, sessão e logout (auth.md §6)', () => {
  it('login abre sessão com cookie httpOnly, SameSite=Strict e de longa duração', async () => {
    await register();
    const res = await login('  ANA@example.com ');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ username: 'Ana.Souza', email: 'ana@example.com' });
    const raw = (res.headers['set-cookie'] as unknown as string[]).join(';');
    expect(raw).toMatch(/vs_session=/);
    expect(raw).toMatch(/HttpOnly/i);
    expect(raw).toMatch(/SameSite=Strict/i);
    expect(raw).toMatch(/Path=\//);
    expect(raw).toMatch(/Max-Age=31536000/);
  });

  it('o banco guarda só o hash do token', async () => {
    const cookie = await loggedIn();
    const token = cookie.split('=')[1]!;
    const sessions = await prisma.session.findMany({ where: { user: { username: 'Ana.Souza' } } });
    expect(sessions).toHaveLength(1);
    expect(sessions[0]!.tokenHash).toBe(hashToken(token));
    expect(sessions[0]!.tokenHash).not.toBe(token);
  });

  it('CA-AUTH-06: senha errada e email inexistente têm a mesma resposta', async () => {
    await register();
    const wrong = await login(valid.email, 'abc123!#');
    const unknown = await login('ninguem@example.com', valid.password);
    expect(wrong.status).toBe(401);
    expect(unknown.status).toBe(401);
    expect(wrong.body).toEqual(unknown.body);
    expect(wrong.body.error.code).toBe('INVALID_CREDENTIALS');
    expect(wrong.headers['set-cookie']).toBeUndefined();
  });

  it('GET /me com sessão devolve o usuário; sem sessão ou adulterada → 401', async () => {
    const cookie = await loggedIn();
    const me = await request(env.app).get('/api/auth/me').set('Cookie', cookie);
    expect(me.status).toBe(200);
    expect(me.body).toMatchObject({ name: 'Ana Souza', username: 'Ana.Souza' });
    expect(me.body.passwordHash).toBeUndefined();

    const none = await request(env.app).get('/api/auth/me');
    expect(none.status).toBe(401);
    expect(none.body.error.code).toBe('UNAUTHENTICATED');
    const tampered = await request(env.app)
      .get('/api/auth/me')
      .set('Cookie', `${cookie.slice(0, -2)}xx`);
    expect(tampered.status).toBe(401);
  });

  it('várias sessões simultâneas; logout encerra só a atual (CA-AUTH-08)', async () => {
    const first = await loggedIn();
    const second = sessionCookie(await login());
    expect(first).not.toBe(second);

    const out = await request(env.app).post('/api/auth/logout').set('Cookie', first);
    expect(out.status).toBe(204);
    expect((out.headers['set-cookie'] as unknown as string[]).join(';')).toMatch(
      /vs_session=;.*Expires=Thu, 01 Jan 1970/,
    );
    expect((await request(env.app).get('/api/auth/me').set('Cookie', first)).status).toBe(401);
    expect((await request(env.app).get('/api/auth/me').set('Cookie', second)).status).toBe(200);
  });

  it('logout sem sessão é idempotente', async () => {
    expect((await request(env.app).post('/api/auth/logout')).status).toBe(204);
  });

  it('renova last_used_at e o cookie após 24 h de uso', async () => {
    const cookie = await loggedIn();
    const old = new Date(Date.now() - 25 * 60 * 60 * 1000);
    const ana = { user: { username: 'Ana.Souza' } };
    await prisma.session.updateMany({ where: ana, data: { lastUsedAt: old } });
    const res = await request(env.app).get('/api/auth/me').set('Cookie', cookie);
    expect(res.status).toBe(200);
    expect((res.headers['set-cookie'] as unknown as string[]).join(';')).toMatch(/vs_session=/);
    const session = await prisma.session.findFirstOrThrow({ where: ana });
    expect(session.lastUsedAt.getTime()).toBeGreaterThan(old.getTime());

    const again = await request(env.app).get('/api/auth/me').set('Cookie', cookie);
    expect(again.headers['set-cookie']).toBeUndefined();
  });
});

describe('limite de tentativas (architecture §22)', () => {
  it('bloqueia com 429 após as tentativas malsucedidas da janela', async () => {
    const app = createApp(
      { prisma, clock: env.clock },
      { authRateLimit: { limit: 2, windowMs: 60_000 } },
    );
    await request(app).post('/api/auth/register').send(valid);
    const attempt = () =>
      request(app).post('/api/auth/login').send({ email: valid.email, password: 'errada1!' });
    expect((await attempt()).status).toBe(401);
    expect((await attempt()).status).toBe(401);
    const blocked = await attempt();
    expect(blocked.status).toBe(429);
    expect(blocked.body.error.code).toBe('TOO_MANY_ATTEMPTS');
  });

  it('tentativas bem-sucedidas não contam', async () => {
    const app = createApp(
      { prisma, clock: env.clock },
      { authRateLimit: { limit: 1, windowMs: 60_000 } },
    );
    await request(app).post('/api/auth/register').send(valid);
    for (let i = 0; i < 3; i++) {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: valid.email, password: valid.password });
      expect(res.status).toBe(200);
    }
  });
});

describe('proteção da API e conta nova (T-62)', () => {
  it.each([
    ['get', '/api/categories'],
    ['get', '/api/payment-methods'],
    ['get', '/api/credit-cards'],
    ['get', '/api/transactions?month=2027-10'],
    ['get', '/api/monthly-statement?month=2027-10'],
    ['get', '/api/recurrences'],
    ['post', '/api/categories'],
    ['post', '/api/financial-periods/2027-10/close'],
  ] as const)('CA-AUTH-07: %s %s sem sessão → 401', async (method, path) => {
    const res = await request(env.app)[method](path).send({});
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHENTICATED');
  });

  it('/health continua público', async () => {
    expect((await request(env.app).get('/health')).status).toBe(200);
  });

  it('CA-AUTH-11: a conta nova recebe só os próprios PIX, Dinheiro e Débito', async () => {
    const cookie = await loggedIn();
    const res = await request(env.app).get('/api/payment-methods').set('Cookie', cookie);
    expect(res.status).toBe(200);
    const methods = res.body.data as { name: string; source: string }[];
    expect(methods.map((m) => m.name).sort()).toEqual(['Dinheiro', 'Débito', 'PIX']);
    expect(methods.every((m) => m.source === 'SYSTEM')).toBe(true);
    const ana = await prisma.user.findFirstOrThrow({ where: { username: 'Ana.Souza' } });
    expect(await prisma.paymentMethod.count({ where: { userId: ana.id } })).toBe(3);
    // o usuário do ambiente continua com os seus três
    expect(await prisma.paymentMethod.count({ where: { userId: env.userId } })).toBe(3);
  });
});

describe('Minha conta (auth.md §8, T-64)', () => {
  const me = (cookie: string) => request(env.app).get('/api/auth/me').set('Cookie', cookie);
  const put = (cookie: string, body: Record<string, unknown>) =>
    request(env.app).put('/api/auth/me').set('Cookie', cookie).send(body);
  const changePassword = (cookie: string, body: Record<string, unknown>) =>
    request(env.app).post('/api/auth/me/password').set('Cookie', cookie).send(body);
  const deleteAccount = (cookie: string, body: Record<string, unknown>) =>
    request(env.app).delete('/api/auth/me').set('Cookie', cookie).send(body);

  it('CA-AUTH-13: edita nome e username com as regras do cadastro', async () => {
    const cookie = await loggedIn();
    const res = await put(cookie, { name: '  Ana   Maria Souza ', username: 'ana-maria' });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      name: 'Ana Maria Souza',
      username: 'ana-maria',
      email: 'ana@example.com',
    });
    expect((await me(cookie)).body.username).toBe('ana-maria');

    expect((await put(cookie, { name: 'Ana' })).status).toBe(400);
    expect((await put(cookie, { username: 'a_b' })).status).toBe(400);
    expect((await put(cookie, {})).status).toBe(400);
    // email não é editável
    expect((await put(cookie, { email: 'nova@example.com' })).status).toBe(400);
  });

  it('username de outro usuário (sem diferenciar maiúsculas) é rejeitado; o próprio é aceito', async () => {
    const cookie = await loggedIn();
    const taken = await put(cookie, { username: 'USUARIO' });
    expect(taken.status).toBe(409);
    expect(taken.body.error.code).toBe('USERNAME_TAKEN');
    expect((await put(cookie, { username: 'ana.souza' })).status).toBe(200);
  });

  it('CA-AUTH-12: trocar senha exige a atual e encerra só as outras sessões', async () => {
    const current = await loggedIn();
    const other = sessionCookie(await login());

    const wrong = await changePassword(current, {
      current_password: 'errada1!',
      new_password: 'nova123!@',
    });
    expect(wrong.status).toBe(422);
    expect(wrong.body.error.code).toBe('INVALID_CURRENT_PASSWORD');
    expect((await me(other)).status).toBe(200);

    const weak = await changePassword(current, {
      current_password: valid.password,
      new_password: 'semnumero!',
    });
    expect(weak.status).toBe(400);

    const ok = await changePassword(current, {
      current_password: valid.password,
      new_password: 'nova123!@',
    });
    expect(ok.status).toBe(204);
    expect((await me(current)).status).toBe(200);
    expect((await me(other)).status).toBe(401);
    expect((await login(valid.email, valid.password)).status).toBe(401);
    expect((await login(valid.email, 'nova123!@')).status).toBe(200);
  });

  it('excluir conta com senha errada é rejeitado e nada é apagado', async () => {
    const cookie = await loggedIn();
    const res = await deleteAccount(cookie, { password: 'errada1!' });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('INVALID_CURRENT_PASSWORD');
    expect((await me(cookie)).status).toBe(200);
  });

  it('CA-AUTH-14: excluir conta apaga todos os dados do usuário e libera email e username', async () => {
    const cookie = await loggedIn();
    const other = sessionCookie(await login());
    const ana = await prisma.user.findFirstOrThrow({ where: { username: 'Ana.Souza' } });
    const as = (path: string) => request(env.app).post(path).set('Cookie', cookie);
    const send = (path: string, body: Record<string, unknown>) => as(path).send(body);
    const get = (path: string) => request(env.app).get(path).set('Cookie', cookie);

    // Dados completos: categoria, cartão, compra, parcelamento, estorno, recorrência com
    // exceção, fatura paga, mês fechado.
    const category = (await send('/api/categories', { name: 'Casa', type: 'EXPENSE' })).body.id;
    const methods = (await get('/api/payment-methods')).body.data as { id: string; name: string }[];
    const pix = methods.find((m) => m.name === 'PIX')!.id;
    const card = (
      await send('/api/credit-cards', { name: 'Nubank', best_purchase_day: 6, due_day: 15 })
    ).body;
    const purchase = await send('/api/transactions', {
      description: 'Mercado',
      amount: 20000,
      purchase_date: '2027-10-01',
      category_id: category,
      payment_method_id: card.payment_method_id,
    });
    expect(purchase.status).toBe(201);
    await send('/api/transactions', {
      description: 'TV',
      amount: 90000,
      purchase_date: '2027-10-01',
      category_id: category,
      payment_method_id: card.payment_method_id,
      installment_count: 3,
    });
    const rec = await send('/api/recurrences', {
      description: 'Academia',
      amount: 10000,
      category_id: category,
      payment_method_id: pix,
      due_day: 1,
      start_date: '2027-10-01',
    });
    await as(`/api/recurrences/${rec.body.id}/occurrences/2027-11/skip`);
    expect(
      (
        await send('/api/refunds', {
          transaction_id: purchase.body.id,
          amount: 5000,
          refund_date: '2027-10-01',
        })
      ).status,
    ).toBe(201);
    expect(
      (
        await send(`/api/invoices/${purchase.body.invoice.id}/pay`, {
          paid_at: '2027-10-01',
          payment_method_id: pix,
        })
      ).status,
    ).toBe(200);
    await prisma.financialPeriod.create({
      data: { userId: ana.id, referenceMonth: '2027-09', status: 'CLOSED', closedAt: new Date() },
    });
    expect(await prisma.transaction.count({ where: { userId: ana.id } })).toBeGreaterThan(3);
    expect(await prisma.refundAllocation.count({ where: { userId: ana.id } })).toBeGreaterThan(0);
    expect(await prisma.recurrenceException.count({ where: { userId: ana.id } })).toBe(1);
    expect(await prisma.invoice.count({ where: { userId: ana.id, status: 'PAID' } })).toBe(1);

    // dados do usuário do ambiente, que não podem ser afetados
    const envCategory = await prisma.category.create({
      data: { userId: env.userId, name: 'Casa', type: 'EXPENSE' },
    });

    const res = await deleteAccount(cookie, { password: valid.password });
    expect(res.status).toBe(204);
    expect((res.headers['set-cookie'] as unknown as string[]).join(';')).toMatch(/vs_session=;/);

    const where = { where: { userId: ana.id } };
    const counts = await Promise.all([
      prisma.refundAllocation.count(where),
      prisma.refund.count(where),
      prisma.installment.count(where),
      prisma.recurrenceException.count(where),
      prisma.transaction.count(where),
      prisma.installmentPlan.count(where),
      prisma.invoice.count(where),
      prisma.recurrence.count(where),
      prisma.creditCard.count(where),
      prisma.paymentMethod.count(where),
      prisma.category.count(where),
      prisma.financialPeriod.count(where),
      prisma.session.count(where),
      prisma.user.count({ where: { id: ana.id } }),
      prisma.jobState.count({ where: { key: { contains: ana.id } } }),
    ]);
    expect(counts).toEqual(counts.map(() => 0));
    expect((await me(cookie)).status).toBe(401);
    expect((await me(other)).status).toBe(401);

    expect(await prisma.category.findUnique({ where: { id: envCategory.id } })).not.toBeNull();
    expect(await prisma.paymentMethod.count({ where: { userId: env.userId } })).toBe(3);
    expect(await prisma.user.count({ where: { id: env.userId } })).toBe(1);

    expect((await register()).status).toBe(201);
  });

  it('rotas de Minha conta exigem sessão', async () => {
    expect((await request(env.app).put('/api/auth/me').send({ name: 'A B' })).status).toBe(401);
    expect((await request(env.app).post('/api/auth/me/password').send({})).status).toBe(401);
    expect((await request(env.app).delete('/api/auth/me').send({})).status).toBe(401);
  });
});
