# T-57 — Apagar lançamentos e compras parceladas (backend)

* **Fase:** 3 — API do backend
* **Depende de:** T-26, T-27, T-31, T-53
* **Status:** Concluída

## Objetivo

Permitir apagar lançamentos, compras de cartão, ocorrências e compras parceladas inteiras (PD-38, provisório).

## Documentos fonte

* `docs/decisions/business-decisions.md` (PD-38)
* `docs/specs/transactions.md` §13
* `docs/specs/installments.md` §11
* `docs/specs/credit-cards.md` §9
* `docs/specs/recurrences.md` §10

## Escopo

* `DELETE /api/transactions/:id` para `MANUAL`, `RECURRENCE` e `CREDIT_CARD`; `INSTALLMENT` isolada continua rejeitada.
* Novo `DELETE /api/installment-plans/:id` (plano, parcelas e estornos, atômico).
* Travas: mês fechado (`PERIOD_CLOSED`) e fatura `PAID` (`INVOICE_ALREADY_PAID`), inclusive em fatura que recebeu crédito de estorno.
* Estornos da compra são apagados junto; faturas que ficarem vazias são removidas; ocorrência de recorrência registra a exceção do mês.

## Fora de escopo

* Usuários, papéis e auditoria: no futuro apagar será privilégio de super admin (PD-38). Não implementar permissões agora.
* Apagar categorias, métodos, cartões, recorrências, faturas ou meses.

## Critérios de aceite

* CA-TRA-15, CA-TRA-15A, CA-CAR-13.

## Testes obrigatórios

* Domínio: `canDeleteTransaction` e `canDeletePlan`.
* Integração (`tests/api/delete.int.spec.ts`): cada origem, travas, estornos em cascata, poda de faturas, plano inteiro, 404.

## Regras para o agente

* Implemente **somente** o escopo desta task.
* As regras de negócio vêm exclusivamente dos documentos fonte listados. Não invente regras.
* Se encontrar ambiguidade ou contradição nos documentos, **interrompa** aquela parte, descreva a dúvida e peça definição (`architecture.md` §24).
* Regras de cálculo ficam nas funções de domínio centralizadas (`architecture.md` §9); não as reimplemente em controllers, repositories ou no frontend.
* Valores monetários sempre em centavos inteiros.

## Definição de pronto

* Critérios de aceite atendidos.
* Testes obrigatórios escritos e passando.
* Build sem erros.
* Nenhuma regra de negócio nova ou divergente da documentação.

## Decisões técnicas registradas

* `canDeleteTransaction` ganhou `invoicePaid`; `canDeletePlan` reaproveita `PlanInstallmentState`. `pruneEmptyInvoices` (invoice-store) é compartilhado com a edição do plano (T-55) e `deleteRefundsOf` (modules/refunds) apaga estornos e alocações. Ordem de locks: recorrência → cartão, igual à geração por data.
