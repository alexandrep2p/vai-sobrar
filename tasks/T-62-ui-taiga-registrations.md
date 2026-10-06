# T-62 — Cadastros no Taiga UI

* **Fase:** 4 — Frontend
* **Depende de:** T-61
* **Status:** Concluída

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

* Campo de texto: `div.field` contendo `tui-textfield` (`label tuiLabel` e `input tuiInput`), `tui-error` e `p.field-hint`. O erro aparece com o campo tocado (`touched && condição`), como o `mat-error`.
* Select de valor simples: `tui-textfield tuiChevron [stringify]` com `input tuiSelect` e `tui-data-list` de `button tuiOption [value]`. O controle guarda o próprio valor (id ou enum), sem objetos.
* Sem botão de limpar nos campos (`tuiTextfieldOptionsProvider({ cleaner: signal(false) })`): o limpar gravaria `null` em controles não anuláveis.
* Botões das linhas: `tuiButton appearance="outline" size="s"`. Ícones isolados viram `tuiIconButton appearance="flat"`, com o rótulo de acessibilidade como texto.
* Verificado no navegador: listas, edição com tipo bloqueado, select de tipo e diálogo de cartão.
