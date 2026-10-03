import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.int.spec.ts'],
    setupFiles: ['tests/integration/setup-env.ts'],
    // Todos compartilham o mesmo banco: arquivos e testes em sequência.
    fileParallelism: false,
    testTimeout: 15000,
  },
});
