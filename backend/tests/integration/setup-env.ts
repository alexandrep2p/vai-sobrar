import 'dotenv/config';

// Testes de integração usam sempre o banco de testes, nunca o de desenvolvimento.
const testUrl = process.env['TEST_DATABASE_URL'];
if (!testUrl) {
  throw new Error('TEST_DATABASE_URL não definida (veja backend/.env.example).');
}
process.env['DATABASE_URL'] = testUrl;
