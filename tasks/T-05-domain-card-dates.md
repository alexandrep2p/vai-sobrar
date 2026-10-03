# T-05 — Domínio: ajuste de dias, fechamento e vencimento

* **Fase:** 1 — Domínio puro
* **Depende de:** T-04
* **Status:** A fazer

## Objetivo

Implementar as funções `effectiveDay`, `closingDate` e `dueDate`.

## Documentos fonte

* `docs/specs/credit-cards.md` — §4, §5, §6
* `docs/architecture/architecture.md` — §9

## Escopo

* `effectiveDay(day, month)` = min(dia, último dia do mês).
* `closingDate(card, month, persistedInvoice?)`: usa o `closing_date` gravado quando a fatura existe; senão calcula com a configuração vigente.
* `dueDate(card, closingDate)`: primeira data com o dia de vencimento efetivo **estritamente posterior** ao fechamento.
* Funções puras, sem acesso a banco.

## Fora de escopo

* Determinação da fatura de uma compra (T-06).

## Critérios de aceite

* CA-CAR-03, CA-CAR-04 (datas), CA-CAR-05 (datas), CA-CAR-06, CA-CAR-07.
* Todos os exemplos de credit-cards §6.4 reproduzidos em teste.

## Testes obrigatórios

* Dias 29/30/31 em meses curtos e fevereiro bissexto.
* Melhor dia 6 / vencimento 15; 25 / 5; 10 / 10; 31 / 30 em fevereiro.
* Fatura persistida com `closing_date` diferente da configuração atual.

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
