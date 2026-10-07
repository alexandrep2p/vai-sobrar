import type { Prisma, PrismaClient } from '@prisma/client';
import { parseLocalDate, type LocalDate } from './dates.js';
import { tenantIdOf } from './tenant.js';

export type Tx = Prisma.TransactionClient;
export type Db = PrismaClient | Tx;

/** `LocalDate` → valor para colunas `DATE` (meia-noite UTC). */
export const toDbDate = (date: LocalDate): Date => new Date(`${date}T00:00:00.000Z`);

/** Coluna `DATE` → `LocalDate`. */
export const fromDbDate = (date: Date): LocalDate =>
  parseLocalDate(date.toISOString().slice(0, 10));

export const fromDbDateOrNull = (date: Date | null): LocalDate | null =>
  date ? fromDbDate(date) : null;

export const TRANSACTION_OPTIONS = { maxWait: 10_000, timeout: 30_000 } as const;

// ---- Locks advisory (escopo de transação) — architecture §20 ----

const exclusive = async (tx: Tx, key: string): Promise<void> => {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${key}, 0))`;
};

/**
 * Serializa operações do mesmo cartão: postagem, pagamento de fatura, estorno, parcelamento.
 * Ordem de aquisição (evita deadlock com o fechamento de mês): períodos (compartilhado) → cartão.
 */
export const lockCard = async (tx: Tx, creditCardId: string): Promise<void> => {
  await lockPeriodsShared(tx);
  await exclusive(tx, `card:${creditCardId}`);
};

/** Serializa a geração/alteração de ocorrências da mesma recorrência (períodos → recorrência). */
export const lockRecurrence = async (tx: Tx, recurrenceId: string): Promise<void> => {
  await lockPeriodsShared(tx);
  await exclusive(tx, `recurrence:${recurrenceId}`);
};

/** Serializa rotinas globais (marca d'água da geração de ocorrências). */
export const lockJob = (tx: Tx, name: string): Promise<void> => exclusive(tx, `job:${name}`);

/**
 * Barreira de meses: toda escrita que depende do estado dos meses toma o lock compartilhado;
 * o fechamento de mês toma o exclusivo. Assim, fechamento e escritas não se intercalam.
 * Os meses são de cada usuário (PD-41): a chave inclui o usuário do cliente restrito.
 */
const periodsKey = (tx: Tx): string => `periods:${tenantIdOf(tx)}`;

export const lockPeriodsShared = async (tx: Tx): Promise<void> => {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock_shared(hashtextextended(${periodsKey(tx)}, 0))`;
};

export const lockPeriodsExclusive = (tx: Tx): Promise<void> => exclusive(tx, periodsKey(tx));
