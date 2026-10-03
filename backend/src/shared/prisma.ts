import { PrismaClient } from '@prisma/client';

/** Cliente Prisma único da aplicação; os repositories o importam daqui. */
export const prisma = new PrismaClient();
