import type { Db } from './db.js';

/** payment-methods.md §3: métodos fornecidos pelo sistema na instalação. */
export const SYSTEM_PAYMENT_METHODS = ['PIX', 'Dinheiro', 'Débito'] as const;

/** Seed idempotente: cria apenas os métodos do sistema que ainda não existem (sem diferenciar maiúsculas). */
export const seedSystemMethods = async (db: Db): Promise<void> => {
  for (const name of SYSTEM_PAYMENT_METHODS) {
    const existing = await db.paymentMethod.findFirst({
      where: { name: { equals: name, mode: 'insensitive' } },
    });
    if (!existing) {
      await db.paymentMethod.create({
        data: { name, source: 'SYSTEM', kind: 'STANDARD', active: true },
      });
    }
  }
};
