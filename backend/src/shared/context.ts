import type { PrismaClient } from '@prisma/client';
import type { Clock } from './clock.js';

/** Dependências injetadas nos casos de uso. */
export interface AppContext {
  prisma: PrismaClient;
  clock: Clock;
}
