import { PrismaClient } from '@prisma/client';
import { seedSystemMethods } from '../src/shared/seed.js';

const prisma = new PrismaClient();

/** Garante os métodos do sistema de cada conta existente (o cadastro já os cria — PD-41). */
const run = async (): Promise<void> => {
  const users = await prisma.user.findMany({ select: { id: true } });
  for (const { id } of users) await seedSystemMethods(prisma, id);
  console.log(`Seed concluído: métodos do sistema de ${users.length} conta(s).`);
};

run()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
