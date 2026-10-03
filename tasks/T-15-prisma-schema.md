# T-15 — Schema Prisma completo

* **Fase:** 2 — Persistência
* **Depende de:** T-02
* **Status:** A fazer

## Objetivo

Modelar todas as entidades do domínio no Prisma, com enums e constraints, e gerar a migration.

## Documentos fonte

* `docs/domain/domain-model.md` — §3, §4, §5
* `docs/architecture/architecture.md` — §7

## Escopo

* 12 tabelas: financial_periods, categories, payment_methods, credit_cards, invoices, transactions, installment_plans, installments, recurrences, recurrence_exceptions, refunds, refund_allocations.
* Enums ASCII da domain-model §5 (sem enums removidos).
* Constraints da architecture §7.1 (unicidades, checks; unicidade case-insensitive de nomes via índice em `lower(name)` ou `citext`).
* Valores monetários em inteiros (centavos); datas sem horário como `DATE`; meses como `YYYY-MM`.
* Mapeamento para snake_case no banco.
* Repositories ainda não fazem parte desta task.

## Fora de escopo

* Seed (T-16).
* Regras de negócio.

## Critérios de aceite

* Migration aplica em banco limpo.
* Todos os campos e relações da domain-model §3 existem; nenhum campo removido na consolidação reaparece (ex.: `Installment.status`, `CreditCard.name`, origem `REFUND`).

## Testes obrigatórios

* Testes de integração das constraints críticas: unicidade de fatura por cartão/mês, de ocorrência por recorrência/mês, de nome de categoria e método sem diferenciar maiúsculas/minúsculas, `due_date > closing_date`, `paid_at` × status, exatamente um alvo em `refunds`.

## Decisões técnicas registradas

_Registrar aqui a técnica escolhida para unicidade sem diferenciar maiúsculas/minúsculas e para o tipo de `YYYY-MM`._

* (preencher durante a implementação)

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
