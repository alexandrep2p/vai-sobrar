# T-13 — Domínio: pré-condições de fechamento do mês

* **Fase:** 1 — Domínio puro
* **Depende de:** T-08
* **Status:** A fazer

## Objetivo

Implementar `canClose(month)` retornando o resultado e o motivo da recusa.

## Documentos fonte

* `docs/specs/financial-periods.md` — §4.1

## Escopo

* Mês `OPEN`; não futuro; todos os lançamentos `PAID`; sem ocorrência projetada; todas as faturas do mês `PAID`; todo mês anterior com lançamentos fechado.
* Motivos mapeados para os códigos de erro (`PERIOD_HAS_PENDING_TRANSACTIONS`, `PERIOD_HAS_UNPAID_INVOICES`, `PERIOD_PREVIOUS_NOT_CLOSED`, `PERIOD_FUTURE_NOT_CLOSABLE`, `PERIOD_CLOSED`).

## Fora de escopo

* Persistência do fechamento (T-33).

## Critérios de aceite

* CA-PER-03, CA-PER-04, CA-PER-04A, CA-PER-05, CA-PER-05A, CA-PER-05B, CA-PER-05C.

## Testes obrigatórios

* Cada pré-condição isolada.
* Mês anterior sem lançamentos não bloqueia.
* Fatura só com créditos não paga bloqueia.
* Mês corrente antes do último dia.

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
