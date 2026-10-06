# T-67 — Calendário do Taiga nos campos de data e mês

* **Fase:** 4 — Frontend
* **Depende de:** T-65
* **Status:** Concluída

## Objetivo

Trocar o seletor nativo do navegador pelos calendários do Taiga UI em todos os campos de data e de mês.

## Documentos fonte

* `docs/architecture/architecture.md` §2
* Documentação do Taiga UI (MCP `taiga-ui`): InputDate, InputMonth, CalendarMonth

## Escopo

* Campos de data dos diálogos (lançamento, edição, estorno, compra parcelada, pagamento, recorrência e pausa): `tuiInputDate` + `tui-calendar`.
* Faturas, "De" e "Até": `tuiInputMonth` + `tui-calendar-month`.
* Home: o título do mês abre `tui-calendar-month`.
* Calendários em português, com datas dd/mm/aaaa.

## Fora de escopo

* Limites de data (mín./máx.) no calendário; as validações continuam no formulário e no backend.

## Critérios de aceite

* Nenhum campo abre o seletor nativo; a data escolhida no calendário é a enviada à API (mesmo formato de antes).

## Testes obrigatórios

* Conversão texto ISO ↔ data/mês do Taiga; diálogo de compra parcelada com a data exibida e digitada em dd/mm/aaaa.

## Regras para o agente

* Implemente **somente** o escopo desta task.
* Troca de componente: nenhuma regra de negócio muda.

## Definição de pronto

* Critérios de aceite atendidos.
* Testes obrigatórios escritos e passando.
* Build sem erros.
* Nenhuma regra de negócio nova ou divergente da documentação.

## Decisões técnicas registradas

* Os formulários continuam guardando texto ISO (`AAAA-MM-DD` / `AAAA-MM`): `IsoDateTransformer` e `IsoMonthTransformer` (`shared/forms/iso-dates.ts`) entram como `valueTransformer` do InputDate/InputMonth, via `providers: [ISO_DATE_INPUTS]` no componente (e não no `app.config`, para valer também nos testes). Vazio = `''`, como antes.
* `core/locale.ts` (`LOCALE_PROVIDERS`): idioma português do Taiga (`TUI_DEFAULT_LANGUAGE`) e `TUI_DATE_FORMAT` `{ mode: 'dd/mm/yyyy', separator: '/' }`. Usado no `app.config` e nos specs que leem o texto da data.
* Home: o `<input type="month">` invisível sobre o título virou um botão com `tuiDropdown` e `tui-calendar-month`. Escolher o mês fecha o calendário e carrega o mês.
* Verificado no navegador: escolha de dia (controle `2026-10-15`), mês da Home e período das Faturas.
