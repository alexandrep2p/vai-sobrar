# T-02 — Ambiente PostgreSQL e Prisma

* **Fase:** 0 — Base técnica
* **Depende de:** T-01
* **Status:** A fazer

## Estado atual

`prisma/schema.prisma` já existe com datasource PostgreSQL e sem modelos; `.env.example` já tem `DATABASE_URL`.

## Objetivo

Disponibilizar o banco PostgreSQL de desenvolvimento e teste e preparar o fluxo de migrations do Prisma.

## Documentos fonte

* `docs/architecture/architecture.md` — §2, §7

## Escopo

* `docker-compose.yml` na raiz com PostgreSQL para desenvolvimento e um banco separado (ou schema) para testes.
* Scripts `prisma:migrate`, `prisma:generate`, `prisma:studio` e `db:reset` no backend.
* Configuração de `DATABASE_URL` para desenvolvimento e testes (`.env.example` atualizado).
* Cliente Prisma único exportado por `src/shared/` para uso dos repositories.
* Utilitário de testes de integração que limpa o banco entre testes.

## Fora de escopo

* Modelos de domínio (T-15).

## Critérios de aceite

* `docker compose up` sobe o banco.
* `prisma migrate dev` executa sem erro com o schema atual.
* Testes de integração conseguem conectar no banco de teste.

## Testes obrigatórios

* Teste de integração simples que abre e fecha conexão com o banco de teste.

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
