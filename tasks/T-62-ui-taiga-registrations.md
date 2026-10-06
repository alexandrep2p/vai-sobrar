# T-62 — Cadastros no Taiga UI

* **Fase:** 4 — Frontend
* **Depende de:** T-61
* **Status:** Pendente

## Objetivo

Migrar as telas de categorias, métodos de pagamento e cartões (páginas, diálogos e specs) para o Taiga UI.

## Documentos fonte

* `docs/architecture/architecture.md` — stack do frontend
* Documentação do Taiga UI (MCP `taiga-ui`)

## Escopo

* `features/categories`, `features/payment-methods`, `features/credit-cards`: campos, selects, botões e ícones Taiga.

## Fora de escopo

* Mudanças de regra ou de layout além da troca de componentes.

## Critérios de aceite

* CAs das specs `categories.md`, `payment-methods.md` e `credit-cards.md` continuam atendidos.
* Build e testes passando.

## Testes obrigatórios

* Specs existentes das três telas adaptados aos componentes Taiga.

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

