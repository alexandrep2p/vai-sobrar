import { PrismaClient } from '@prisma/client';
import { seedSystemMethods } from '../src/shared/seed.js';

const prisma = new PrismaClient();

seedSystemMethods(prisma)
  .then(() => console.log('Seed concluído: métodos de pagamento do sistema.'))
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
