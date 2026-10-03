# T-06 — Domínio: ciclo da compra e fatura de postagem

* **Fase:** 1 — Domínio puro
* **Depende de:** T-05
* **Status:** A fazer

## Objetivo

Implementar `cycleOf` e `postingInvoice`, incluindo compra retroativa e compra tardia.

## Documentos fonte

* `docs/specs/credit-cards.md` — §7, §8
* `docs/architecture/architecture.md` — §9, §11.1

## Escopo

* `cycleOf`: ciclo M ou M+1 pela `purchase_date` e pelo `closing_date(M)`.
* `postingInvoice`: fatura do ciclo, exceto quando `PAID` ou de mês fechado → próxima fatura não paga com mês aberto, percorrendo ciclos em ordem.
* Retorna se a fatura precisa ser criada e com qual `closing_date`/`due_date`/status inicial (`CLOSED` se o fechamento já passou).
* Recebe faturas existentes e estado dos meses como dados (sem banco).

## Fora de escopo

* Persistência e API (T-22).

## Critérios de aceite

* CA-CAR-02, CA-CAR-08, CA-CAR-09, CA-CAR-11.
* Compra de 05/10 cadastrada em 20/10 continua no ciclo de outubro.

## Testes obrigatórios

* Antes, no e depois do melhor dia.
* Fatura do ciclo `CLOSED` não paga (aceita).
* Fatura do ciclo `PAID` → próxima.
* Mês do ciclo fechado → próxima.
* Várias faturas seguidas pagas.
* Fatura inexistente com fechamento passado → criada `CLOSED`.
* Mudança de melhor dia com fatura persistida (credit-cards §12).

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
