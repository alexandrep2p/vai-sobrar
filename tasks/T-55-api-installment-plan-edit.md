# T-55 — Edição de compra parcelada (backend)

* **Fase:** 3 — API do backend
* **Depende de:** T-26, T-27
* **Status:** Concluída

## Objetivo

Permitir editar valor total, quantidade de parcelas e data da compra de plano não pago e sem estorno (PD-36).

## Documentos fonte

* `docs/decisions/business-decisions.md` (PD-36, PD-12)
* `docs/specs/installments.md` §6, §7, §8, §9
* `docs/specs/transactions.md` §10 e §12

## Escopo

* Estender `PUT /api/installment-plans/:id` com `total_amount`, `installment_count` e `purchase_date` (opcionais).
* Regenerar parcelas atomicamente reaproveitando a criação (`splitCents`, ciclos), mantendo o id do plano.
* Rejeitar (`INVALID_INSTALLMENT_OPERATION`) com parcela em fatura `PAID`, mês afetado fechado ou estorno vinculado.
* Atualizar `edit-guards` (domínio puro), o controle de concorrência e a coleção Bruno.

## Fora de escopo

* Qualquer regra não descrita nos documentos fonte.

## Critérios de aceite

* Exemplo da PD-36 (R$ 600 em 3x → R$ 660 em 6x); soma das parcelas igual ao total.

## Testes obrigatórios

* Testes de domínio (`edit-guards`) e de integração (permitido, cada bloqueio, atomicidade, concorrência).

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

* `PUT /api/installment-plans/:id` aceita `total_amount`, `installment_count` (2..120) e `purchase_date`. Regras no domínio puro `canEditPlanStructure` (mês fechado → `PERIOD_CLOSED`; fatura paga → `INVOICE_ALREADY_PAID`; estorno → `INVALID_INSTALLMENT_OPERATION`).
* Regenera apagando `Installment` e `Transaction` do plano e recriando por `insertInstallments` (mesma criação original), com o mesmo id de plano; faturas que ficarem sem lançamentos, créditos e crédito recebido são removidas (invoices.md §4). Janela de data retroativa só se a data mudar. Valores iguais aos atuais não regeneram.
* A matriz de edição por parcela (`canEditField`) não mudou: valor de parcela isolada continua `NO`.
