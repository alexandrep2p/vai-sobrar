# T-36 — Tela de categorias

* **Fase:** 4 — Frontend
* **Depende de:** T-17, T-35
* **Status:** Concluída

## Objetivo

Implementar a tela de categorias.

## Documentos fonte

* `docs/specs/categories.md` — §9

## Escopo

* Lista por estado e tipo; criar; editar; ativar/desativar; estados carregando, vazio e erro.

## Fora de escopo

* Regras de validação além das básicas (o backend é a autoridade).

## Critérios de aceite

* Ações da categories §9 disponíveis conforme o estado.
* Erros do backend exibidos.

## Testes obrigatórios

* Testes de componente das ações principais.

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

* Tela em `features/categories`: lista agrupada por estado (ativas/inativas) e tipo (entradas/saídas); diálogo de criar/editar; ativar/desativar. Sem exclusão (categories §9).
* O tipo fica desabilitado na edição quando `in_use` é verdadeiro (dica de interface); o backend continua sendo a autoridade (CATEGORY_TYPE_LOCKED).
* Estados carregando, vazio e erro com nova tentativa pelo componente compartilhado `app-load-state`.
