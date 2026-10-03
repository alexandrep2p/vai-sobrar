# T-41 — Ações do lançamento na Home

* **Fase:** 4 — Frontend
* **Depende de:** T-40
* **Status:** A fazer

## Objetivo

Permitir editar, pagar/desfazer e excluir lançamentos a partir do extrato.

## Documentos fonte

* `docs/specs/transactions.md` — §9, §12, §13

## Escopo

* Exibir somente as ações permitidas pela origem e estado (matriz de edição, fatura paga, mês fechado).
* Pagar com data; desfazer; excluir manual; para itens de cartão, indicar que a liquidação é pela fatura.

## Fora de escopo

* Pagamento de fatura (T-42).

## Critérios de aceite

* Ações indisponíveis não aparecem; o backend continua sendo a autoridade.

## Testes obrigatórios

* Testes de componente das ações por origem.

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
