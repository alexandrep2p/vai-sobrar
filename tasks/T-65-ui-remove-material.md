# T-65 — Remoção do Angular Material

* **Fase:** 4 — Frontend
* **Depende de:** T-62, T-63, T-64
* **Status:** Concluída

## Objetivo

Remover o Angular Material e o CDK do projeto após a migração para o Taiga UI.

## Documentos fonte

* `docs/architecture/architecture.md` — stack do frontend
* Documentação do Taiga UI (MCP `taiga-ui`)

## Escopo

* Remover `@angular/material` e o tema pré-compilado do `angular.json` (o `@angular/cdk` sai se nada mais o exigir).
* Nenhuma referência a `mat-`, `@angular/material` ou `--mat-sys` em `src`.
* Orçamento do build conferido; verificação visual no desktop e em 375px.

## Fora de escopo

* Novas funcionalidades.

## Critérios de aceite

* App sem dependência do Material, com todas as telas funcionando.
* Build e testes passando.

## Testes obrigatórios

* Suíte completa passando.

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

* `@angular/material` removido. O `@angular/cdk` fica como dependência direta: é peer obrigatório do `@taiga-ui/cdk`, mesmo sem uso direto no código do app.
* Saíram o tema `azure-blue.css`, os links de Roboto e Material Icons do `index.html` e o seletor `mat-form-field` do `styles.css`. A fonte passa a ser a do Taiga (Manrope).
* Nenhuma referência a `mat-`, `@angular/material` ou `--mat-sys` em `src`.
* Build: 626 kB iniciais, abaixo do aviso de 700 kB.
* Verificado no navegador com o servidor reiniciado: nenhum CSS do Material carregado, Home no desktop e em 375px, confirmação de fechamento de mês (cancelada).
