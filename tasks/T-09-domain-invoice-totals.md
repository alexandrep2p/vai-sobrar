# T-09 — Domínio: totais da fatura e saldo credor

* **Fase:** 1 — Domínio puro
* **Depende de:** T-04
* **Status:** Concluída

## Objetivo

Implementar `invoiceTotals(invoice)`.

## Documentos fonte

* `docs/specs/invoices.md` — §7, §8

## Escopo

* Débitos, créditos (alocações reconhecidas), crédito recebido (saldos credores transferidos).
* `valor_a_pagar = max(0, débitos − créditos − crédito_recebido)`.
* `saldo_credor = max(0, créditos + crédito_recebido − débitos)`.

## Fora de escopo

* Transferência persistida do saldo (T-25).

## Critérios de aceite

* CA-FAT-10 (cálculo).
* Valor a pagar nunca negativo.

## Testes obrigatórios

* Sem créditos; com créditos parciais; créditos maiores que débitos; com crédito recebido; cascata.

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

* `invoiceTotals` recebe listas de centavos (débitos, créditos, créditos recebidos) e devolve também as somas parciais. Código em `src/domain/invoice-totals.ts`.
