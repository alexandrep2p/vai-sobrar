# T-15 — Schema Prisma completo

* **Fase:** 2 — Persistência
* **Depende de:** T-02
* **Status:** Concluída

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

* Unicidade case-insensitive de nomes: índice único em `lower(name)` (`categories_name_lower_key`, `payment_methods_name_lower_key`), criado em SQL na migration; sem `citext`.
* `YYYY-MM` é `CHAR(7)` com CHECK de formato (`^[0-9]{4}-(0[1-9]|1[0-2])$`) em todas as colunas de mês. Datas são `DATE` (o Prisma devolve `Date` à meia-noite UTC; os repositories convertem para `LocalDate`).
* IDs são UUID (`@db.Uuid`, gerados pelo Prisma); valores monetários são `Int` (32 bits, até R$ 21.474.836,47 — limite técnico do banco); timestamps `Timestamptz(3)`.
* CHECKs ficam na migration `*_domain_schema` (Prisma não os expressa): os da architecture §7.1 mais formato de mês e as condições "somente quando" do domain-model — pagamento da fatura (`paid_at` e `payment_method_id` se e somente se `PAID`), recorrência na transação (se e somente se `origin = RECURRENCE`), `cancelled_at` (se e somente se `CANCELLED`), `credit_balance >= 0`, `total_amount > 0`, `number >= 1`.
* Campo novo `Recurrence.cancelled_at` (DATE, opcional), aprovado pelo usuário: viabiliza CD-22 (cancelamento bloqueia ocorrências com data >= cancelamento). Propagado a `domain-model.md` §3.9 e `recurrences.md` §3.
* A unicidade `(recurrence_id, occurrence_month)` entre ocorrências **e exceções** (recurrences §3) é garantida por unicidade em cada tabela; a exclusividade entre as duas é do caso de uso (pular remove o lançamento e cria a exceção na mesma transação).
* Relações obrigatórias usam `ON DELETE RESTRICT` (padrão do Prisma): nada que preserve histórico é excluído em cascata.
* Constraints cobertas por `tests/integration/constraints.int.spec.ts`.
