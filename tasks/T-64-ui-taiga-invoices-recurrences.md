# T-64 — Faturas e recorrências no Taiga UI

* **Fase:** 4 — Frontend
* **Depende de:** T-61
* **Status:** Pendente

## Objetivo

Migrar as telas de faturas e recorrências e seus diálogos para o Taiga UI.

## Documentos fonte

* `docs/architecture/architecture.md` — stack do frontend
* Documentação do Taiga UI (MCP `taiga-ui`)

## Escopo

* `features/invoices` (lista e detalhe da fatura) e `features/recurrences` (lista, cadastro e pausa).

## Fora de escopo

* Mudanças de regra.

## Critérios de aceite

* CAs de `invoices.md` e `recurrences.md` continuam atendidos.
* Build e testes passando.

## Testes obrigatórios

* `invoices.spec.ts` e `recurrences.spec.ts` adaptados.

## Regras para o agente

* Implemente **somente** o escopo desta task.
* Troca de biblioteca de componentes: nenhuma regra de negócio muda. Comportamento e textos permanecem os mesmos.
* Se encontrar ambiguidade ou contradição nos documentos, **interrompa** aquela parte, descreva a dúvida e peça definição (`architecture.md` §24).
* Valores monetários sempre em centavos inteiros.

## Definição de pronto

* Critérios de aceite atendidos.
* Testes obrigatórios escritos e passando.
* Build sem erros.
* Nenhuma regra de negócio nova ou divergente da documentação.

## Decisões técnicas registradas

