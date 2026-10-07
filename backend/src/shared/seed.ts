import type { Db } from './db.js';

/** payment-methods.md §3: métodos fornecidos pelo sistema a cada conta criada (PD-41). */
export const SYSTEM_PAYMENT_METHODS = ['PIX', 'Dinheiro', 'Débito'] as const;

/** Seed idempotente do usuário: cria apenas os métodos do sistema que ele ainda não tem. */
export const seedSystemMethods = async (db: Db, userId: string): Promise<void> => {
  for (const name of SYSTEM_PAYMENT_METHODS) {
    const existing = await db.paymentMethod.findFirst({
      where: { userId, name: { equals: name, mode: 'insensitive' } },
    });
    if (!existing) {
      await db.paymentMethod.create({
        data: { userId, name, source: 'SYSTEM', kind: 'STANDARD', active: true },
      });
    }
  }
};
