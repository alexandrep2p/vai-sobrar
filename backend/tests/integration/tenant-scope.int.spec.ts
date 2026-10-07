import type { PrismaClient } from '@prisma/client';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { scopeArgs, scopedPrisma, tenantIdOf, TenantScopeError } from '../../src/shared/tenant.js';
import { prisma, resetDatabase } from './db.js';

// Extensão de escopo por usuário (PD-41, architecture §22).

let userA: string;
let userB: string;
let dbA: PrismaClient;
let dbB: PrismaClient;

const makeUser = async (username: string): Promise<string> =>
  (
    await prisma.user.create({
      data: { name: `Teste ${username}`, username, email: `${username}@t.com`, passwordHash: 'x' },
    })
  ).id;

beforeEach(async () => {
  await resetDatabase();
  userA = await makeUser('ana');
  userB = await makeUser('bruno');
  dbA = scopedPrisma(prisma, userA);
  dbB = scopedPrisma(prisma, userB);
});
afterAll(() => prisma.$disconnect());

describe('scopedPrisma', () => {
  it('create grava o userId do contexto', async () => {
    const created = await dbA.category.create({
      data: { name: 'Mercado', type: 'EXPENSE' } as never,
    });
    expect(created.userId).toBe(userA);
  });

  it('create/update com userId de outro usuário falha', async () => {
    await expect(
      dbA.category.create({ data: { userId: userB, name: 'X', type: 'EXPENSE' } }),
    ).rejects.toBeInstanceOf(TenantScopeError);
    const own = await dbA.category.create({ data: { userId: userA, name: 'Y', type: 'EXPENSE' } });
    await expect(
      dbA.category.update({ where: { id: own.id }, data: { userId: userB } }),
    ).rejects.toBeInstanceOf(TenantScopeError);
  });

  it('leituras, contagens e agrupamentos veem só o usuário', async () => {
    await dbA.category.create({ data: { userId: userA, name: 'A1', type: 'EXPENSE' } });
    await dbA.category.create({ data: { userId: userA, name: 'A2', type: 'INCOME' } });
    const b1 = await dbB.category.create({ data: { userId: userB, name: 'B1', type: 'EXPENSE' } });

    expect((await dbA.category.findMany()).map((c) => c.name).sort()).toEqual(['A1', 'A2']);
    expect(await dbA.category.count()).toBe(2);
    expect(await dbA.category.findUnique({ where: { id: b1.id } })).toBeNull();
    expect(await dbA.category.findFirst({ where: { name: 'B1' } })).toBeNull();
    await expect(dbA.category.findUniqueOrThrow({ where: { id: b1.id } })).rejects.toThrow();
    const groups = await dbA.category.groupBy({ by: ['type'], _count: true });
    expect(groups).toHaveLength(2);
    expect(await dbB.category.count()).toBe(1);
  });

  it('update/delete de registro de outro usuário não acontece', async () => {
    const b1 = await dbB.category.create({ data: { userId: userB, name: 'B1', type: 'EXPENSE' } });
    await expect(
      dbA.category.update({ where: { id: b1.id }, data: { name: 'Invadido' } }),
    ).rejects.toThrow();
    expect((await dbA.category.updateMany({ data: { name: 'Invadido' } })).count).toBe(0);
    await expect(dbA.category.delete({ where: { id: b1.id } })).rejects.toThrow();
    expect((await dbA.category.deleteMany({})).count).toBe(0);
    expect((await prisma.category.findUniqueOrThrow({ where: { id: b1.id } })).name).toBe('B1');
  });

  it('upsert por chave composta usa o usuário do contexto', async () => {
    const upsert = (db: PrismaClient, userId: string) =>
      db.financialPeriod.upsert({
        where: { userId_referenceMonth: { userId, referenceMonth: '2027-10' } },
        create: { userId, referenceMonth: '2027-10', status: 'CLOSED' },
        update: { status: 'CLOSED' },
      });
    await upsert(dbA, userA);
    await upsert(dbB, userB);
    await upsert(dbA, userA);
    expect(await prisma.financialPeriod.count()).toBe(2);
    await expect(upsert(dbA, userB)).rejects.toThrow();
  });

  it('vale dentro de $transaction interativo e expõe o usuário ao tx', async () => {
    await dbB.category.create({ data: { userId: userB, name: 'B1', type: 'EXPENSE' } });
    const seen = await dbA.$transaction(async (tx) => {
      await tx.category.create({ data: { userId: tenantIdOf(tx), name: 'A1', type: 'EXPENSE' } });
      return { id: tenantIdOf(tx), names: (await tx.category.findMany()).map((c) => c.name) };
    });
    expect(seen).toEqual({ id: userA, names: ['A1'] });
  });

  it('modelos fora do escopo (User, Session, JobState) não são filtrados', async () => {
    expect(await dbA.user.count()).toBe(2);
  });

  it('cliente sem escopo não informa usuário', () => {
    expect(() => tenantIdOf(prisma)).toThrow(TenantScopeError);
    expect(tenantIdOf(dbA)).toBe(userA);
  });

  it('operação não prevista falha fechado', () => {
    expect(() => scopeArgs('Category', 'findRaw', {}, userA)).toThrow(TenantScopeError);
    expect(scopeArgs('Category', 'findMany', { where: { name: 'X' } }, userA)).toEqual({
      where: { name: 'X', userId: userA },
    });
  });
});

describe('constraints por usuário', () => {
  it('nome de categoria e de método único por usuário, sem diferenciar maiúsculas', async () => {
    await dbA.category.create({ data: { userId: userA, name: 'Mercado', type: 'EXPENSE' } });
    await expect(
      dbB.category.create({ data: { userId: userB, name: 'MERCADO', type: 'EXPENSE' } }),
    ).resolves.toBeTruthy();
    await expect(
      dbA.category.create({ data: { userId: userA, name: 'mercado', type: 'INCOME' } }),
    ).rejects.toThrow();

    await dbA.paymentMethod.create({ data: { userId: userA, name: 'Vale', source: 'USER' } });
    await expect(
      dbB.paymentMethod.create({ data: { userId: userB, name: 'vale', source: 'USER' } }),
    ).resolves.toBeTruthy();
    await expect(
      dbA.paymentMethod.create({ data: { userId: userA, name: 'VALE', source: 'USER' } }),
    ).rejects.toThrow();
  });

  it('mês único por usuário', async () => {
    await dbA.financialPeriod.create({ data: { userId: userA, referenceMonth: '2027-10' } });
    await expect(
      dbB.financialPeriod.create({ data: { userId: userB, referenceMonth: '2027-10' } }),
    ).resolves.toBeTruthy();
    await expect(
      dbA.financialPeriod.create({ data: { userId: userA, referenceMonth: '2027-10' } }),
    ).rejects.toThrow();
  });

  it('users: email e username únicos sem diferenciar maiúsculas; formato do username', async () => {
    const user = (username: string, email: string) =>
      prisma.user.create({ data: { name: 'Teste X', username, email, passwordHash: 'x' } });
    await expect(user('ANA', 'outra@t.com')).rejects.toThrow();
    await expect(user('outra', 'ana@t.com')).rejects.toThrow();
    await expect(user('Outra.Pessoa-1', 'outra@t.com')).resolves.toBeTruthy();
    await expect(user('com_underline', 'x@t.com')).rejects.toThrow();
    await expect(user('ab', 'y@t.com')).rejects.toThrow();
    await expect(user('valido', 'MAIUSCULA@t.com')).rejects.toThrow();
  });

  it('registro de negócio exige usuário existente', async () => {
    await expect(
      prisma.category.create({
        data: {
          userId: '00000000-0000-0000-0000-000000000000',
          name: 'X',
          type: 'EXPENSE',
        },
      }),
    ).rejects.toThrow();
  });
});
