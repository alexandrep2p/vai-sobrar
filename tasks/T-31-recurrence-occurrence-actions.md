# T-31 — Ações em ocorrências

* **Fase:** 3 — API
* **Depende de:** T-30
* **Status:** Concluída

## Objetivo

Permitir editar, pagar e pular ocorrências.

## Documentos fonte

* `docs/specs/recurrences.md` — §9, §10, §15
* `docs/specs/transactions.md` — §12, §13
* `docs/architecture/architecture.md` — §18.8

## Escopo

* Editar (gera a ocorrência se projetada) conforme a tabela de recurrences §9.
* Pagar ocorrência com método comum (gera se projetada).
* Pular: projetada → exceção; gerada com método comum `PENDING` → remove o lançamento e cria a exceção na mesma transação; rejeita paga, de cartão gerada ou de mês fechado (`RECURRENCE_OCCURRENCE_NOT_SKIPPABLE`).

## Fora de escopo

* Estorno de ocorrência de cartão (T-27).

## Critérios de aceite

* CA-REC-07, CA-REC-07A, CA-REC-08, CA-REC-09, CA-REC-10, CA-REC-10A, CA-REC-10B, CA-REC-16.

## Testes obrigatórios

* Testes de API dos critérios.

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

* Editar/pagar uma ocorrência projetada a gera na mesma transação (rejeições desfazem a geração). Editar usa a matriz de edição; `category_id` é aceito no corpo apenas para ser rejeitado. Pular: projetada → exceção; gerada comum `PENDING` → remove o lançamento e cria a exceção; demais casos → `RECURRENCE_OCCURRENCE_NOT_SKIPPABLE`; ocorrência inexistente → `RECURRENCE_OCCURRENCE_NOT_FOUND`.
