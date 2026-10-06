# T-59 — Home: painéis por cartão e filtros

* **Fase:** 4 — Frontend
* **Depende de:** T-39, T-41
* **Status:** Concluída

## Objetivo

Reduzir a lista do extrato agrupando os itens de cada cartão em painéis recolhidos e permitir filtrar por categoria e método de pagamento (PD-39).

## Documentos fonte

* `docs/decisions/business-decisions.md` (PD-39)
* `docs/specs/home.md` §3.2, RN-HOME-06B/06C, CA-HOME-13..15

## Escopo

* `mat-expansion-panel` por cartão (recolhido por padrão), com nome, quantidade e total no cabeçalho.
* Itens sem cartão continuam em lista.
* Filtros de categoria e método (múltipla escolha), botão "Limpar" e linha "Filtrados: N itens · total".
* Com filtro ativo, painéis abrem sozinhos e painéis sem itens somem; estado vazio por filtro.
* Mesmas ações do item dentro e fora dos painéis.

## Fora de escopo

* Filtros por status, texto ou período; persistência dos filtros; mudanças no backend.

## Critérios de aceite

* CA-HOME-13, CA-HOME-14 e CA-HOME-15.

## Testes obrigatórios

* Componente da Home: painéis, filtros (único e múltiplo), totais inalterados, estado vazio e ações dentro do painel.

## Regras para o agente

* Implemente **somente** o escopo desta task.
* As regras de negócio vêm exclusivamente dos documentos fonte listados. Não invente regras.
* Se encontrar ambiguidade ou contradição nos documentos, **interrompa** aquela parte, descreva a dúvida e peça definição (`architecture.md` §24).
* Valores monetários sempre em centavos inteiros.

## Definição de pronto

* Critérios de aceite atendidos.
* Testes obrigatórios escritos e passando.
* Build sem erros.
* Nenhuma regra de negócio nova ou divergente da documentação.

## Decisões técnicas registradas

* `mat-accordion multi` com um `mat-expansion-panel` por cartão (`[expanded]` acompanha `filtersActive()`), conteúdo renderizado mesmo recolhido. A linha do item virou o `ng-template #row`, usado na lista e nos painéis.
* Filtros são signals de ids (`categoryFilter`, `methodFilter`); as opções vêm dos itens do mês e seleções que deixam de existir ao trocar de mês são descartadas. Totais do topo continuam do mês inteiro; `filteredSummary` mostra contagem e total dos itens filtrados.
* Verificado no navegador (desktop e 375px) contra o banco de testes.
