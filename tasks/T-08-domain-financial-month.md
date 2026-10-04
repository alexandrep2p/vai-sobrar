# T-08 — Domínio: mês financeiro

* **Fase:** 1 — Domínio puro
* **Depende de:** T-05
* **Status:** Concluída

## Objetivo

Implementar `financialMonth(item)` para todos os tipos de item do planejamento.

## Documentos fonte

* `docs/specs/financial-periods.md` — §3
* `docs/specs/credit-cards.md` — §7

## Escopo

* Método comum → mês do `due_date`.
* Lançamento de cartão → `reference_month` da fatura de postagem.
* Ocorrência projetada → regra correspondente usando data/fatura projetadas.
* Alocação de estorno → `reference_month` da fatura de reconhecimento.

## Fora de escopo

* Persistência.

## Critérios de aceite

* Para cartão, o mês financeiro nunca é `mês(due_date)` (melhor dia 25 / vencimento 5: compra 20/10 → outubro).
* `paid_at` nunca altera o mês.

## Testes obrigatórios

* Cada tipo de item.
* Cartão com vencimento no mês seguinte.

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

* `financialMonth` recebe uma união discriminada (`COMMON_TRANSACTION`, `CARD_TRANSACTION`, `REFUND_ALLOCATION`, `PROJECTED_OCCURRENCE` com o item projetado dentro); `paid_at` não é parâmetro. Código em `src/domain/financial-month.ts`.
