# T-61 — Diálogos e componentes compartilhados no Taiga UI

* **Fase:** 4 — Frontend
* **Depende de:** T-60
* **Status:** Concluída

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

* `AppDialog.open(component, data)` abre via `TuiDialogService` (`size: 'm'`) e aplica `defaultIfEmpty(undefined)`: dispensar (Cancelar, X, Esc, clique fora) emite `undefined`, como o antigo `afterClosed()`. Os chamadores só trocaram `MatDialog` por `AppDialog` e perderam o `.afterClosed()`.
* Nos diálogos, `protected readonly ref = injectDialog<D, R>()` substitui `MAT_DIALOG_DATA` e `MatDialogRef`. Os dados ficam em `ref.data`; `ref.close(valor)` chama `completeWith` e `ref.close()` sem valor só dispensa.
* Esqueleto comum: `h2.dialog-title`, `div.dialog-content` e `footer.dialog-actions` (estilos em `styles.css`). No mobile, o diálogo ocupa a largura menos 0,5rem de cada lado.
* Botões: `mat-flat-button` virou `tuiButton`, `mat-button` virou `appearance="flat"`, `mat-stroked-button` virou `appearance="outline"` e o destaque destrutivo virou `appearance="primary-destructive"`. O tamanho padrão é `m`, via `tuiButtonOptionsProvider`.
* `load-state`: `tui-loader` e botão outline.
* Testes: `dialogProviders(data, ref)` fornece o contexto Polymorpheus (fechamento observado em `ref.close`) e um `AppDialog` falso. O resumo de confirmação é lido (`summaryRow`) e respondido (`answerSummary`) pelo registro desse falso, sem overlay no DOM. Os mocks de `open` devolvem o Observable diretamente.
* Convivência: campos Material (`mat-form-field`, `mat-select`) dentro de diálogos Taiga funcionam. O dropdown do `mat-select` abre acima do diálogo, sem conflito de z-index.
* Verificado no navegador (desktop e 375px): novo lançamento, select, resumo aninhado (Voltar), Cancelar e Esc, sem gravar dados.
