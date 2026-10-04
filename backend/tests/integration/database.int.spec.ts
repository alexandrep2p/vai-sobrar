import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { prisma, resetDatabase } from './db.js';

describe('banco de testes', () => {
  beforeEach(resetDatabase);
  afterAll(() => prisma.$disconnect());

  it('conecta no banco de testes e responde a uma consulta', async () => {
    const [row] = await prisma.$queryRaw<{ db: string }[]>`SELECT current_database() AS db`;
    expect(row?.db).toBe('vai_sobrar_test');
  });
});
