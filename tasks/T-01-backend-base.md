# T-01 — Completar a estrutura do backend

* **Fase:** 0 — Base técnica
* **Depende de:** —
* **Status:** Concluída

## Estado atual

Já existem: Express + TypeScript (ESM, NodeNext), Vitest, Zod, Prisma (schema sem modelos), supertest e `GET /health` com teste.

## Objetivo

Completar o esqueleto do backend já existente para a organização por módulos e camadas definida na arquitetura.

## Documentos fonte

* `docs/architecture/architecture.md` — §2, §4, §6

## Escopo

* Criar a estrutura `src/modules/`, `src/domain/` e `src/shared/` conforme architecture §6.
* Padronizar a pasta de testes (unitários de domínio e testes de API) e garantir que o Vitest os encontre.
* Adicionar lint/format (ESLint + Prettier) com scripts no `package.json`.
* Manter o endpoint `/health` e o seu teste funcionando.
* Documentar no README do backend os scripts disponíveis.

## Fora de escopo

* Regras de negócio, entidades, schema Prisma.
* Docker e banco (T-02).

## Critérios de aceite

* Estrutura de pastas igual à architecture §6.
* `npm test`, `npm run build` e `npm run lint` executam sem erro.
* `GET /health` continua respondendo 200.

## Testes obrigatórios

* Teste existente de `/health` continua passando.

## Regras para o agente

* Implemente **somente** o escopo desta task.
* As regras de negócio vêm exclusivamente dos documentos fonte listados. Não invente regras.
* Se encontrar ambiguidade ou contradição nos documentos, **interrompa** aquela parte, descreva a dúvida e peça definição (`architecture.md` §24).
* Regras de cálculo ficam nas funções de domínio centralizadas (`architecture.md` §9); não as reimplemente em controllers, repositories ou no frontend.
* Valores monetários sempre em centavos inteiros.
* Datas que dependem de "hoje" usam o relógio injetável (T-04), para permitir testes determinísticos.

## Definição de pronto

* Critérios de aceite atendidos.
* Testes obrigatórios escritos e passando (`npm test`).
* Build sem erros (`npm run build`).
* Nenhuma regra de negócio nova ou divergente da documentação.
* Se uma decisão técnica foi tomada nesta task, ela está registrada na seção "Decisões técnicas registradas" deste arquivo.

## Decisões técnicas registradas

* Testes em `backend/tests/domain/` (unitários de domínio) e `backend/tests/api/` (API); o Vitest inclui `tests/**/*.spec.ts`. O teste de `/health` foi movido para `tests/api/`.
* ESLint 9 (flat config, `typescript-eslint`) + Prettier (`eslint-config-prettier`); aspas simples, `printWidth` 100. Diretório `prisma/` ignorado pelo lint e pelo format.
* Diretórios vazios mantidos com `.gitkeep`.
