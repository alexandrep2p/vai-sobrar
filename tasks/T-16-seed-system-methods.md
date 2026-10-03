# T-16 — Seed dos métodos do sistema

* **Fase:** 2 — Persistência
* **Depende de:** T-15
* **Status:** Concluída

## Objetivo

Garantir que PIX, Dinheiro e Débito existam desde a instalação.

## Documentos fonte

* `docs/specs/payment-methods.md` — §3

## Escopo

* Seed idempotente com `source = SYSTEM`, `kind = STANDARD`, `active = true`.
* Integração com `prisma db seed`.

## Fora de escopo

* API de métodos (T-18).

## Critérios de aceite

* CA-MET-01.
* Executar o seed duas vezes não duplica registros.

## Testes obrigatórios

* Idempotência do seed.

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

* Seed idempotente em `src/shared/seed.ts` (`seedSystemMethods`): cria PIX, Dinheiro e Débito (`SYSTEM`/`STANDARD`/ativos) só se não existir método com o mesmo nome (sem diferenciar maiúsculas). Integrado a `prisma db seed` (`prisma/seed.ts`, via `tsx`) e também executado na inicialização do servidor.
