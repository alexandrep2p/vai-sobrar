# T-42 — Telas de faturas

* **Fase:** 4 — Frontend
* **Depende de:** T-24, T-25, T-38
* **Status:** Concluída

## Objetivo

Implementar a lista de faturas por cartão, o detalhe e o pagamento.

## Documentos fonte

* `docs/specs/invoices.md`

## Escopo

* Lista por período, incluindo ciclos "Sem lançamentos".
* Detalhe: status, situação de atraso, fechamento, vencimento, lançamentos, créditos, crédito recebido, valor a pagar, saldo credor.
* Ação "Pagar fatura" (somente `CLOSED`) com data e método (exclui o próprio cartão).

## Fora de escopo

* Estorno (T-43).

## Critérios de aceite

* Pagamento funcional; R$ 0,00 permitido; erros exibidos.

## Testes obrigatórios

* Testes de componente da lista, do detalhe e do pagamento.

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

* Faturas em `features/invoices`: seleção de cartão (aceita `?cartao=`) e período (padrão: 3 meses atrás a 8 à frente = 12 meses, dentro do limite de 60 do backend). Ciclos sem fatura aparecem como "Sem lançamentos", sem detalhe.
* Detalhe em diálogo: status, atraso, fechamento, vencimento, lançamentos, créditos, crédito recebido, totais e saldo credor. "Pagar fatura" só com status `CLOSED`; data e método (ativos, exceto o método do próprio cartão); R$ 0,00 permitido.
