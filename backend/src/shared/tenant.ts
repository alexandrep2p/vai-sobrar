import type { PrismaClient } from '@prisma/client';
import type { Db } from './db.js';

/**
 * Isolamento por usuário (PD-41, architecture §22): cliente Prisma restrito a um usuário.
 * Toda leitura, alteração e exclusão dos modelos de negócio recebe `userId` no filtro; toda
 * criação grava o `userId` do usuário. Operação não prevista falha (nunca passa sem filtro).
 * Não cobre SQL cru (`$queryRaw`/`$executeRaw`) nem escritas aninhadas, que levam `userId`
 * explicitamente.
 */
export const TENANT_MODELS: ReadonlySet<string> = new Set([
  'FinancialPeriod',
  'Category',
  'PaymentMethod',
  'CreditCard',
  'Invoice',
  'Transaction',
  'InstallmentPlan',
  'Installment',
  'Recurrence',
  'RecurrenceException',
  'Refund',
  'RefundAllocation',
]);

const WHERE_OPERATIONS: ReadonlySet<string> = new Set([
  'findUnique',
  'findUniqueOrThrow',
  'findFirst',
  'findFirstOrThrow',
  'findMany',
  'count',
  'aggregate',
  'groupBy',
  'delete',
  'deleteMany',
]);

const UPDATE_OPERATIONS: ReadonlySet<string> = new Set([
  'update',
  'updateMany',
  'updateManyAndReturn',
]);

const CREATE_OPERATIONS: ReadonlySet<string> = new Set([
  'create',
  'createMany',
  'createManyAndReturn',
]);

type Data = Record<string, unknown>;

export class TenantScopeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TenantScopeError';
  }
}

const scopeWhere = (where: unknown, userId: string): Data => ({
  ...((where as Data | undefined) ?? {}),
  // Espalhado (sem AND) para manter os seletores únicos de findUnique/update/delete.
  userId,
});

const assertSameUser = (model: string, data: Data, userId: string): void => {
  if (data['userId'] !== undefined && data['userId'] !== userId) {
    throw new TenantScopeError(`${model}: userId diferente do usuário do contexto.`);
  }
};

const ownData = (model: string, data: unknown, userId: string): Data => {
  const record = (data as Data | undefined) ?? {};
  assertSameUser(model, record, userId);
  return { ...record, userId };
};

const ownDataList = (model: string, data: unknown, userId: string): Data | Data[] =>
  Array.isArray(data) ? data.map((d) => ownData(model, d, userId)) : ownData(model, data, userId);

/** Aplica o escopo do usuário aos argumentos de uma operação de modelo. */
export const scopeArgs = (
  model: string,
  operation: string,
  args: unknown,
  userId: string,
): Data => {
  const a = { ...((args as Data | undefined) ?? {}) };
  if (WHERE_OPERATIONS.has(operation)) {
    a['where'] = scopeWhere(a['where'], userId);
    return a;
  }
  if (UPDATE_OPERATIONS.has(operation)) {
    a['where'] = scopeWhere(a['where'], userId);
    assertSameUser(model, (a['data'] as Data | undefined) ?? {}, userId);
    return a;
  }
  if (CREATE_OPERATIONS.has(operation)) {
    a['data'] = ownDataList(model, a['data'], userId);
    return a;
  }
  if (operation === 'upsert') {
    a['where'] = scopeWhere(a['where'], userId);
    a['create'] = ownData(model, a['create'], userId);
    assertSameUser(model, (a['update'] as Data | undefined) ?? {}, userId);
    return a;
  }
  throw new TenantScopeError(`${model}.${operation}: operação sem escopo de usuário.`);
};

/** Cliente Prisma restrito ao usuário; também vale dentro de `$transaction` interativo. */
export const scopedPrisma = (base: PrismaClient, userId: string): PrismaClient =>
  base.$extends({
    client: { $tenantId: () => userId },
    query: {
      $allModels: {
        $allOperations({ model, operation, args, query }) {
          if (!TENANT_MODELS.has(model)) return query(args);
          return query(scopeArgs(model, operation, args, userId) as typeof args);
        },
      },
    },
  }) as unknown as PrismaClient;

/** Usuário do cliente (ou transação) restrito; falha se o cliente não estiver restrito. */
export const tenantIdOf = (db: Db): string => {
  const getter = (db as unknown as { $tenantId?: () => string }).$tenantId;
  if (typeof getter !== 'function') {
    throw new TenantScopeError('Cliente Prisma sem escopo de usuário.');
  }
  return getter();
};
