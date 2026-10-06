# T-61 — Diálogos e componentes compartilhados no Taiga UI

* **Fase:** 4 — Frontend
* **Depende de:** T-60
* **Status:** Pendente

## Objetivo

Trocar a infraestrutura de diálogos para o Taiga UI por meio de uma abstração própria (`AppDialog` / `injectDialog`) e migrar os componentes compartilhados.

## Documentos fonte

* `docs/architecture/architecture.md` — stack do frontend
* Documentação do Taiga UI (MCP `taiga-ui`)

## Escopo

* `shared/ui/dialog.ts`: serviço `AppDialog.open(component, data)` sobre `TuiDialogService`, emitindo `undefined` ao fechar sem valor; helper `injectDialog()` com `data` e `close()`.
* `confirm-dialog`, `pay-dialog`, `summary-dialog` e `load-state` com componentes Taiga.
* Esqueleto de todos os diálogos (título, conteúdo, ações, injeção de dados e fechamento) e todos os chamadores passam a usar `AppDialog`.
* `testing/helpers.ts` e specs desacoplados do `MatDialog`.

## Fora de escopo

* Campos de formulário internos dos diálogos de feature (T-62 a T-64).

## Critérios de aceite

* Todos os fluxos com diálogo (criar, editar, pagar, estornar, confirmar, resumo de confirmação) continuam funcionando.
* Build e testes passando.

## Testes obrigatórios

* Resumo de confirmação: "Voltar" mantém o formulário, "Confirmar" grava.
* Diálogos compartilhados: dados exibidos e valor de fechamento.

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

