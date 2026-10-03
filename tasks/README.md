# Tasks — Vai Sobrar

Tasks de implementação derivadas da documentação SDD (`docs/`). Cada task é pequena, indica seus documentos fonte e não pode criar regras de negócio.

## Fases

| Fase | Conteúdo |
|---|---|
| 0 | Base técnica |
| 1 | Regras de domínio puras (funções da architecture §9), sem banco |
| 2 | Persistência (schema Prisma e seed) |
| 3 | API do backend |
| 4 | Frontend |
| 5 | Validação transversal |

## Ordem sugerida

`T-01 → T-04 → T-05…T-14 → T-15 → T-16 → T-17 → … → T-34`, com o frontend (T-35 em diante) avançando em paralelo assim que cada API existir. As Fases 1 e 2 são independentes entre si.

## Lista

| Task | Título | Fase | Depende de | Status |
|---|---|---|---|---|
| [T-01](T-01-backend-base.md) | Completar a estrutura do backend | 0 | — | A fazer |
| [T-02](T-02-database-setup.md) | Ambiente PostgreSQL e Prisma | 0 | T-01 | A fazer |
| [T-03](T-03-frontend-base.md) | Revisar a estrutura do frontend | 0 | — | A fazer |
| [T-04](T-04-shared-infra.md) | Infraestrutura compartilhada do backend | 0 | T-01 | A fazer |
| [T-05](T-05-domain-card-dates.md) | Domínio: ajuste de dias, fechamento e vencimento | 1 | T-04 | A fazer |
| [T-06](T-06-domain-posting-invoice.md) | Domínio: ciclo da compra e fatura de postagem | 1 | T-05 | A fazer |
| [T-07](T-07-domain-split-cents.md) | Domínio: distribuição de centavos | 1 | T-04 | A fazer |
| [T-08](T-08-domain-financial-month.md) | Domínio: mês financeiro | 1 | T-05 | A fazer |
| [T-09](T-09-domain-invoice-totals.md) | Domínio: totais da fatura e saldo credor | 1 | T-04 | A fazer |
| [T-10](T-10-domain-allocate-refund.md) | Domínio: distribuição de estornos | 1 | T-07 | A fazer |
| [T-11](T-11-domain-recognition-invoice.md) | Domínio: fatura de reconhecimento do estorno | 1 | T-06 | A fazer |
| [T-12](T-12-domain-recurrence-eligibility.md) | Domínio: elegibilidade e data de ocorrência | 1 | T-05 | A fazer |
| [T-13](T-13-domain-can-close.md) | Domínio: pré-condições de fechamento do mês | 1 | T-08 | A fazer |
| [T-14](T-14-domain-edit-guards.md) | Domínio: regras de edição e imutabilidade | 1 | T-08 | A fazer |
| [T-15](T-15-prisma-schema.md) | Schema Prisma completo | 2 | T-02 | A fazer |
| [T-16](T-16-seed-system-methods.md) | Seed dos métodos do sistema | 2 | T-15 | A fazer |
| [T-17](T-17-api-categories.md) | API de categorias | 3 | T-15 | A fazer |
| [T-18](T-18-api-payment-methods.md) | API de métodos de pagamento | 3 | T-16 | A fazer |
| [T-19](T-19-api-credit-cards.md) | API de cartões | 3 | T-18 | A fazer |
| [T-20](T-20-period-guard.md) | Serviço de meses e guarda de mês fechado | 3 | T-08, T-15 | A fazer |
| [T-21](T-21-api-manual-transactions.md) | Lançamentos manuais | 3 | T-14, T-17, T-18, T-20 | A fazer |
| [T-22](T-22-api-card-purchase.md) | Compra à vista no cartão | 3 | T-06, T-19, T-21 | A fazer |
| [T-23](T-23-invoice-status-transition.md) | Transição automática de fatura e de pausa | 3 | T-22 | A fazer |
| [T-24](T-24-api-invoices-read.md) | Leitura de faturas | 3 | T-09, T-23 | A fazer |
| [T-25](T-25-api-invoice-payment.md) | Pagar fatura | 3 | T-24 | A fazer |
| [T-26](T-26-api-installments.md) | Compra parcelada | 3 | T-07, T-22 | A fazer |
| [T-27](T-27-api-refunds.md) | Estornos | 3 | T-10, T-11, T-25, T-26 | A fazer |
| [T-28](T-28-api-recurrences.md) | Cadastro de recorrências | 3 | T-17, T-18, T-23 | A fazer |
| [T-29](T-29-recurrence-projection.md) | Projeção de ocorrências | 3 | T-12, T-28 | A fazer |
| [T-30](T-30-recurrence-generation.md) | Geração de ocorrências na data | 3 | T-29, T-22 | A fazer |
| [T-31](T-31-recurrence-occurrence-actions.md) | Ações em ocorrências | 3 | T-30 | A fazer |
| [T-32](T-32-api-monthly-statement.md) | Extrato mensal | 3 | T-21, T-24, T-27, T-29 | A fazer |
| [T-33](T-33-api-close-month.md) | Fechamento do mês | 3 | T-13, T-25, T-31 | A fazer |
| [T-34](T-34-concurrency.md) | Proteção contra concorrência | 3 | T-25, T-27, T-30, T-33 | A fazer |
| [T-35](T-35-frontend-core.md) | Base do frontend | 4 | T-03 | A fazer |
| [T-36](T-36-ui-categories.md) | Tela de categorias | 4 | T-17, T-35 | A fazer |
| [T-37](T-37-ui-payment-methods.md) | Tela de métodos de pagamento | 4 | T-18, T-35 | A fazer |
| [T-38](T-38-ui-credit-cards.md) | Tela de cartões | 4 | T-19, T-35 | A fazer |
| [T-39](T-39-ui-home.md) | Home: navegação, resumo e extrato | 4 | T-32, T-35 | A fazer |
| [T-40](T-40-ui-transaction-form.md) | Formulário de lançamento | 4 | T-21, T-22, T-26, T-39 | A fazer |
| [T-41](T-41-ui-transaction-actions.md) | Ações do lançamento na Home | 4 | T-40 | A fazer |
| [T-42](T-42-ui-invoices.md) | Telas de faturas | 4 | T-24, T-25, T-38 | A fazer |
| [T-43](T-43-ui-refunds.md) | Fluxo de estorno | 4 | T-27, T-42 | A fazer |
| [T-44](T-44-ui-recurrences.md) | Telas de recorrências e ações em ocorrências | 4 | T-28, T-31, T-39 | A fazer |
| [T-45](T-45-ui-close-month.md) | Fluxo de fechamento do mês | 4 | T-33, T-39 | A fazer |
| [T-46](T-46-integration-scenarios.md) | Cenários de integração ponta a ponta | 5 | T-34 | A fazer |

## Como usar

1. Escolha a próxima task cujas dependências estejam concluídas.
2. Entregue ao agente o arquivo da task; ele deve ler os documentos fonte listados.
3. Ao concluir, atualize o **Status** no arquivo da task e nesta tabela.
4. Decisões técnicas tomadas durante a task são registradas no próprio arquivo, na seção "Decisões técnicas registradas".
5. Se surgir dúvida de negócio, a task para naquele ponto; a decisão é registrada em `docs/decisions/business-decisions.md` e propagada para a spec antes de continuar.
