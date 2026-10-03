import { defineConfig } from 'vitest/config';

// `npm test` roda só testes sem banco; `npm run test:integration` exige o PostgreSQL de teste.
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.spec.ts'],
    exclude: ['tests/**/*.int.spec.ts', 'node_modules'],
  },
});
