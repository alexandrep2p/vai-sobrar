# T-63 — Home no Taiga UI

* **Fase:** 4 — Frontend
* **Depende de:** T-61
* **Status:** Pendente

## Objetivo

Migrar a Home (extrato, painéis por cartão, filtros, menu de ações) e seus diálogos para o Taiga UI.

## Documentos fonte

* `docs/architecture/architecture.md` — stack do frontend
* Documentação do Taiga UI (MCP `taiga-ui`)

## Escopo

* `home.page.*`: accordion por cartão, filtros de múltipla escolha, menu de ações do item, botões e ícones.
* Diálogos: transaction-form, transaction-edit, refund, close-month, purchase-detail, plan-edit.

## Fora de escopo

* Mudanças de regra (home.md, PD-39) ou novos filtros.

## Critérios de aceite

* CA-HOME-* (incluindo CA-HOME-13..15) continuam atendidos.
* Build e testes passando.

## Testes obrigatórios

* `home.page.spec.ts`, `dialogs.spec.ts`, `item-actions.spec.ts`, `plan-edit.spec.ts` adaptados.

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

