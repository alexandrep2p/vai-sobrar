# T-47 — Registrar PD-33..PD-37 e corrigir specs e índice

* **Fase:** 0 — Base técnica
* **Depende de:** —
* **Status:** Concluída

## Objetivo

Registrar as decisões do teste manual e propagá-las às specs; resolver o merge do índice de tasks.

## Documentos fonte

* `docs/decisions/business-decisions.md` (PD-33..PD-37)
* `docs/specs/invoices.md`, `recurrences.md`, `installments.md`, `transactions.md`, `home.md`

## Escopo

* Registrar PD-33 a PD-37 e ampliar a PD-12.
* Atualizar as specs nos pontos impactados.
* Resolver os marcadores de merge de `tasks/README.md` e criar T-47..T-56.

## Fora de escopo

* Qualquer regra não descrita nos documentos fonte.

## Critérios de aceite

* Specs e registro de decisões consistentes entre si.
* `tasks/README.md` sem marcadores de merge.

## Testes obrigatórios

* Revisão de documentação.

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

* —
