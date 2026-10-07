# Backend — Vai Sobrar

Node.js + Express + TypeScript (ESM), Prisma, Zod e Vitest. Arquitetura em `docs/architecture/architecture.md`.

## Estrutura

```text
src/
├── modules/   um diretório por módulo, com rotas (Zod + HTTP) e serviços (casos de uso)
│   ├── categories/  payment-methods/  credit-cards/  financial-periods/
│   ├── transactions/  installments/  invoices/  refunds/
│   └── recurrences/  monthly-statement/
├── domain/    regras puras (ciclo do cartão, centavos, estornos, elegibilidade, fechamento, guardas de edição)
├── shared/    erros, dinheiro, datas, relógio, locks, cliente Prisma, rotina de atualização
├── app.ts
└── server.ts
prisma/        schema, migrations e seed
tests/
├── domain/       testes unitários de domínio
├── shared/       testes da infraestrutura compartilhada
├── api/          testes de API (supertest + PostgreSQL de teste) e health
└── integration/  banco de testes e constraints
```

## Como rodar

Na raiz do repositório, suba o PostgreSQL (dois bancos: `vai_sobrar` e `vai_sobrar_test`):

```bash
docker compose up -d
```

No `backend`, na primeira vez (copie `.env.example` para `.env`):

```bash
npm install
npm run prisma:migrate
npm run db:test:migrate
npm run dev
```

O servidor sobe em `http://localhost:3000` e inicia a rotina periódica (transição de faturas/pausas e geração de ocorrências de recorrência, para cada usuário). Toda a API, exceto `POST /api/auth/register` e `POST /api/auth/login`, exige a sessão em cookie (`vs_session`); cada conta recebe PIX, Dinheiro e Débito ao ser criada (PD-41). Em produção, defina `COOKIE_SECURE=true` (HTTPS) e, atrás de proxy reverso, `TRUST_PROXY` (veja `.env.example`).

Para recriar os bancos do zero: `docker compose down -v` e `docker compose up -d`.

## Scripts

| Script                     | O que faz                                                            |
| -------------------------- | -------------------------------------------------------------------- |
| `npm run dev`              | servidor em modo watch (`tsx`)                                       |
| `npm run build`            | compila TypeScript para `dist/`                                      |
| `npm start`                | executa `dist/server.js`                                             |
| `npm test`                 | testes sem banco (domínio, infraestrutura, health)                   |
| `npm run test:watch`       | testes em modo watch                                                 |
| `npm run test:integration` | testes de API e de banco em `vai_sobrar_test` (exige o Docker no ar) |
| `npm run test:all`         | os dois conjuntos de testes                                          |
| `npm run lint`             | ESLint                                                               |
| `npm run lint:fix`         | ESLint com correção automática                                       |
| `npm run format`           | formata com Prettier                                                 |
| `npm run format:check`     | verifica formatação sem alterar                                      |
| `npm run prisma:generate`  | gera o Prisma Client                                                 |
| `npm run prisma:migrate`   | cria/aplica migrations no banco de desenvolvimento                   |
| `npm run prisma:studio`    | abre o Prisma Studio                                                 |
| `npm run db:reset`         | recria o banco de desenvolvimento aplicando as migrations            |
| `npm run db:seed`          | cria os métodos de pagamento do sistema (idempotente)                |
| `npm run db:test:migrate`  | aplica as migrations no banco de testes                              |

## API

Todos os endpoints estão em `docs/architecture/architecture.md` §18 e na collection do Bruno (`bruno/`). Convenções:

- JSON em `snake_case`; datas `YYYY-MM-DD`, meses `YYYY-MM`; valores em **centavos** inteiros.
- Listas voltam como `{ "data": [...] }`.
- Erros: `{ "error": { "code", "message", "details?" } }` — validação (`VALIDATION_ERROR`, 400), regras de negócio (404 não encontrado, 409 conflito com o estado atual, 422 demais violações) e `INTERNAL_ERROR` (500).
- "Hoje" vem do relógio injetado (`Clock`); em produção é a data do servidor.

## Decisões técnicas relevantes

- **Transições por tempo e geração de ocorrências:** a cada requisição à API e a cada 15 minutos o sistema fecha faturas vencidas (`OPEN → CLOSED`), aplica pausas programadas e gera as ocorrências de recorrência com data até hoje (com marca d'água, sem geração retroativa).
- **Concorrência:** locks advisory do PostgreSQL por cartão, por recorrência e por "períodos" (fechamento de mês × escritas), sempre na ordem períodos → cartão/recorrência.
- Detalhes por task em `tasks/T-*.md`, seção "Decisões técnicas registradas".
