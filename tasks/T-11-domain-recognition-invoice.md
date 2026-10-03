# T-11 — Domínio: fatura de reconhecimento do estorno

* **Fase:** 1 — Domínio puro
* **Depende de:** T-06
* **Status:** Concluída

## Objetivo

Implementar `recognitionInvoice`, que decide em qual fatura cada alocação é reconhecida.

## Documentos fonte

* `docs/specs/refunds.md` — §6, §8
* `docs/specs/invoices.md` — §5.1

## Escopo

* Fatura do lançamento-alvo se `OPEN` e com mês aberto.
* Senão, fatura do ciclo da `refund_date` (regra de `cycleOf`) se puder receber crédito; senão, próxima fatura do cartão que possa, percorrendo ciclos.
* Ciclo sem fatura persistida com fechamento passado é pulado (não cria fatura vazia).
* Indica quando a fatura escolhida precisa ser criada.
* Validação de `refund_date` (`purchase_date ≤ refund_date ≤ hoje`).

## Fora de escopo

* Persistência (T-27).

## Critérios de aceite

* CA-EST-11, CA-EST-14, CA-EST-15.
* Faturas `CLOSED` e `PAID` nunca recebem crédito.

## Testes obrigatórios

* Alvo em fatura `OPEN`, `CLOSED`, `PAID` e de mês fechado.
* Fatura do estorno também não elegível → próxima aberta.
* Parcela futura em fatura `OPEN`.
* Ciclos passados sem fatura são pulados.

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

* `recognitionInvoice` recebe a fatura do alvo, `refund_date`, faturas persistidas, `ClosedMonths` e `today`. Fatura `OPEN` persistida é aceita pelo status gravado (a transição automática é da T-23). Ciclo sem fatura com fechamento passado (`closing_date < hoje`) é pulado.
* `validateRefundDate` lança `INVALID_REFUND_DATE`. Código em `src/domain/refund-recognition.ts`.
