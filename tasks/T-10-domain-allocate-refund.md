# T-10 — Domínio: distribuição de estornos

* **Fase:** 1 — Domínio puro
* **Depende de:** T-07
* **Status:** Concluída

## Objetivo

Implementar `allocateRefund` com as três estratégias e os limites de valor.

## Documentos fonte

* `docs/specs/refunds.md` — §5, §7

## Escopo

* Validação: `amount` > 0 e ≤ saldo estornável da compra (rejeita acima, `REFUND_EXCEEDS_REMAINING_AMOUNT`).
* Saldo estornável por parcela = valor original − alocações anteriores.
* `FIRST_INSTALLMENTS`, `LAST_INSTALLMENTS`, `PROPORTIONAL` (pesos = saldo estornável de cada parcela; centavos pela regra da T-07).
* Compra à vista / ocorrência de cartão: uma única alocação.

## Fora de escopo

* Escolha da fatura de reconhecimento (T-11).

## Critérios de aceite

* CA-EST-03, CA-EST-07, CA-EST-08, CA-EST-09, CA-EST-10.
* Soma das alocações = valor estornado; nenhuma alocação acima do saldo da parcela.

## Testes obrigatórios

* Cada estratégia com e sem estornos anteriores.
* Estorno total.
* Pedido acima do saldo rejeitado.
* Centavos no proporcional.

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

* Alvo modelado como `SINGLE` (compra à vista/ocorrência) ou `PLAN` (parcelas com valor original e alocado). Retorna só alocações > 0, em ordem de parcela.
* `amount` não positivo ou estratégia incoerente com o alvo lançam `RangeError` (erro de programação/validação Zod); acima do saldo lança `BusinessError` `REFUND_EXCEEDS_REMAINING_AMOUNT`. Código em `src/domain/refund-allocation.ts`.
