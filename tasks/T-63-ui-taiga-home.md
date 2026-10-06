# T-63 — Home no Taiga UI

* **Fase:** 4 — Frontend
* **Depende de:** T-61
* **Status:** Concluída

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

* Painéis por cartão: `tui-accordion [closeOthers]="false"`, com `button [tuiAccordion]="filtersActive()"` como cabeçalho (`data-testid="card-panel"`) e `tui-expand` como corpo. Os dois precisam ser filhos diretos do accordion. O `tui-expand` sem `*tuiItem` mantém os itens renderizados mesmo recolhidos, como na T-59. Nos testes, o painel aberto é `aria-expanded="true"` e os itens ficam no elemento seguinte ao cabeçalho.
* Filtros: `tui-textfield multi tuiChevron` com `input tuiInputChip tuiSelectLike` (não editável), chips (`tui-input-chip *tuiItem`) e `tui-opt-group tuiMultiSelectGroup`. Os valores são ids; os nomes vêm de `[stringify]` (`categoryName` e `methodName`).
* Menu de ações do item: `tuiIconButton` com `[tuiDropdown]` e `tui-data-list`. Só um menu fica aberto por vez (`openMenu`, a chave do item), e a escolha de uma ação fecha o menu antes de executá-la.
* Formulário de lançamento: o alternador Saída/Entrada virou `tui-segmented` com radios `formControlName="type"`. Os selects de id usam `nameById` (`shared/forms/options.ts`); na edição, o próprio item entra no `stringify` para o campo não ficar vazio antes de as listas carregarem.
* `pay-dialog` (compartilhado) migrado junto, por ser usado na Home.
* Testes: `tuiRoot()` cria o `TuiRoot` no mesmo TestBed, e `overlay()` lê menus e dropdowns abertos nele. `click()` também atualiza o root. O TestBed tira do documento os elementos raiz anteriores, por isso a leitura é pelo root e não por `document`.
* Cards de saldo: `--tui-status-info-pale`, em vez do accent laranja, que soaria como alerta.
* Verificado no navegador (desktop e 375px): painéis, filtro com chip e painel abrindo, menu → Editar (select com nome), Saída/Entrada, sem gravar dados.
