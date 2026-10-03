// Aplica as migrations no banco de testes (TEST_DATABASE_URL).
import 'dotenv/config';
import { spawnSync } from 'node:child_process';

const url = process.env.TEST_DATABASE_URL;
if (!url) {
  console.error('TEST_DATABASE_URL não definida (veja backend/.env.example).');
  process.exit(1);
}

const result = spawnSync('npx', ['prisma', 'migrate', 'deploy'], {
  stdio: 'inherit',
  shell: true,
  env: { ...process.env, DATABASE_URL: url },
});
process.exit(result.status ?? 1);
