# Modelo de Domínio — Vai Sobrar

## 1. Objetivo

Definir as entidades do domínio, seus campos conceituais, seus relacionamentos, os invariantes fundamentais e as enumerações canônicas.

O domínio é orientado a **planejamento financeiro** (saldo previsto, não saldo bancário) e à **preservação do histórico**.

Este documento é a fonte normativa de **entidades, campos, relacionamentos e enumerações**. As regras operacionais detalhadas ficam nas specs indicadas em cada seção. O registro das decisões está em `docs/decisions/business-decisions.md`.

---

## 2. Visão geral

```text
FinancialPeriod (mês, lógico)
      ▲ financial_month
      │
Transaction ───────────► Category
  │  │  │  └────────────► PaymentMethod ──1:1──► CreditCard ──► Invoice ──► (reference_month)
  │  │  └── invoice_id ─────────────────────────────────────────▲
  │  └── recurrence_id ──► Recurrence ──► RecurrenceException
  └── (1:1) ◄── Installment ──► InstallmentPlan ──► CreditCard

Refund ──► Transaction | InstallmentPlan
  └── RefundAllocation ──► Transaction (alvo) + Invoice (reconhecimento)
```

* Lançamento (`Transaction`) é a única unidade que representa entrada ou saída no planejamento.
* Fatura (`Invoice`) agrupa e liquida lançamentos de cartão; não é despesa.
* Plano de parcelamento (`InstallmentPlan`) é metadado da compra parcelada; não gera transação-mãe.
* Recorrência (`Recurrence`) é regra; ocorrências são lançamentos.
* Estorno (`Refund`) é crédito sobre compra de cartão; não é lançamento e não tem categoria.
* Toda entidade acima pertence a um usuário (`User`, PD-40). Os dados de um usuário nunca são vistos nem alterados por outro, e todas as regras (unicidade de nomes, meses, fechamento) valem dentro dos dados de cada usuário.

---

## 3. Entidades

### 3.1 FinancialPeriod — mês financeiro

Fonte normativa: `specs/financial-periods.md`.

```text
id
reference_month   (YYYY-MM, único)
status            (FinancialPeriodStatus)
closed_at
created_at
updated_at
```

* Meses existem logicamente e estão `OPEN` até o fechamento explícito; o registro é persistido quando necessário.
* Fechamento: manual, irreversível, exige todos os lançamentos `PAID`, todas as faturas do mês `PAID` e todo mês anterior com lançamentos fechado; meses futuros não fecham, o mês corrente pode fechar antes do fim.
* Mês fechado é imutável, inclusive as faturas com aquele `reference_month`.

### 3.2 Category

Fonte normativa: `specs/categories.md`.

```text
id
name        (único, sem diferenciar maiúsculas/minúsculas)
type        (CategoryType)
active      (booleano)
created_at
updated_at
```

* O tipo determina a natureza de todo lançamento associado.
* O tipo é imutável depois de qualquer uso persistido (lançamento ou recorrência).
* Nunca é excluída.

### 3.3 PaymentMethod

Fonte normativa: `specs/payment-methods.md`.

```text
id
name        (único entre todos os métodos, sem diferenciar maiúsculas/minúsculas)
source      (PaymentMethodSource)
kind        (PaymentMethodKind)
active      (booleano; é também o estado do cartão)
created_at
updated_at
```

* PIX, Dinheiro e Débito: `SYSTEM`, `STANDARD`, não editáveis.
* `CREDIT_CARD` existe somente com `CreditCard` associado.
* Nunca é excluído.

### 3.4 CreditCard

Fonte normativa: `specs/credit-cards.md`.

```text
id
payment_method_id   (1:1, único)
best_purchase_day   (1..31)
due_day             (1..31)
created_at
updated_at
```

* Nome e estado ativo ficam no `PaymentMethod` (fonte única).
* A configuração vale somente para ciclos cuja fatura ainda não foi persistida.

### 3.5 Invoice

Fonte normativa: `specs/invoices.md`; ciclo em `specs/credit-cards.md` §6.

```text
id
credit_card_id
reference_month                    (único por cartão)
closing_date                       (gravado na criação)
due_date                           (gravado na criação; estritamente posterior ao closing_date)
status                             (InvoiceStatus)
paid_at                            (somente PAID)
payment_method_id                  (somente PAID; diferente do método do próprio cartão)
credit_balance                     (saldo credor apurado no pagamento)
credit_transferred_to_invoice_id   (fatura que recebeu o saldo credor)
created_at
updated_at
```

* Persistida somente quando recebe o primeiro lançamento ou crédito.
* `OPEN → CLOSED` automático após o `closing_date`; `OPEN → PAID` e `CLOSED → PAID` somente pela ação "Pagar fatura"; `PAID` é final.
* Atraso (`OVERDUE`) é situação derivada.
* Recebe créditos de estorno somente quando `OPEN` e com mês aberto.
* Seus lançamentos são liquidados somente pela ação "Pagar fatura"; lançamentos de fatura `PAID` não são editáveis.
* O `reference_month` é o mês financeiro dos lançamentos postados.

### 3.6 Transaction — lançamento

Fonte normativa: `specs/transactions.md`.

```text
id
description
amount              (centavos, > 0)
financial_month     (YYYY-MM)
due_date
paid_at             (somente PAID)
status              (TransactionStatus)
category_id
payment_method_id
origin              (TransactionOrigin)
purchase_date       (lançamentos de cartão)
invoice_id          (lançamentos de cartão)
recurrence_id       (origin = RECURRENCE)
occurrence_month    (origin = RECURRENCE; único com recurrence_id)
created_at
updated_at
```

* Natureza = tipo da categoria.
* `financial_month`: mês do `due_date` para método comum; `reference_month` da fatura para cartão.
* `created_at` (cadastro) ≠ `purchase_date` (compra) ≠ `due_date` (vencimento) ≠ `paid_at` (liquidação).

### 3.7 InstallmentPlan

Fonte normativa: `specs/installments.md`.

```text
id
credit_card_id
total_amount        (centavos)
installment_count   (>= 2)
purchase_date
created_at
updated_at
```

* Todos os campos são imutáveis depois da criação.
* Descrição e categoria ficam nas transações das parcelas, sempre iguais entre si.

### 3.8 Installment

```text
id
installment_plan_id
transaction_id      (1:1, único)
number              (1..installment_count)
created_at
```

* Valor, fatura, vencimento, status e `paid_at` estão na `Transaction`.

### 3.9 Recurrence

Fonte normativa: `specs/recurrences.md`.

```text
id
description
amount
category_id
payment_method_id   (pode ser cartão)
due_day             (1..31)
start_date
end_date            (opcional)
status              (RecurrenceStatus)
paused_from         (opcional)
paused_until        (opcional)
cancelled_at        (opcional; data do cancelamento, somente com status = CANCELLED)
created_at
updated_at
```

* Ocorrências futuras não geradas são projetadas a partir da configuração atual.
* Ocorrência é gerada na sua data ou antes, quando o usuário a paga ou edita; depois disso não é alterada pela recorrência.

### 3.10 RecurrenceException

```text
id
recurrence_id
occurrence_month    (único com recurrence_id)
created_at
```

* Registra que a ocorrência do mês foi pulada. É o único tipo de exceção do MVP.

### 3.11 Refund

Fonte normativa: `specs/refunds.md`.

```text
id
transaction_id         (alvo: compra à vista ou ocorrência de recorrência de cartão)
installment_plan_id    (alvo: compra parcelada)
amount                 (centavos, > 0)
refund_date
strategy               (RefundStrategy; somente para compra parcelada)
created_at
```

### 3.12 RefundAllocation

```text
id
refund_id
transaction_id      (lançamento da compra ou parcela que recebe o crédito)
amount              (centavos, > 0)
invoice_id          (fatura de reconhecimento)
created_at
```

* Mês financeiro da alocação = `reference_month` da fatura de reconhecimento.
* Soma das alocações = `Refund.amount`; nenhuma alocação ultrapassa o saldo estornável do lançamento-alvo.

### 3.13 User — conta do usuário (PD-40)

```text
User
├── id
├── name        (1–100, ao menos 2 palavras)
├── username    (3–30, A–Z a–z 0–9 . -; único sem diferenciar maiúsculas)
├── email       (único sem diferenciar maiúsculas; imutável)
├── password_hash
├── created_at
└── updated_at
```

* Todas as entidades das seções 3.1 a 3.12 têm `user_id` e pertencem a exatamente um usuário.
* A sessão de login (`Session`) é registro técnico, sem efeito financeiro (`specs/auth.md`).
* Excluir a conta apaga o usuário e todos os dados dele (`specs/auth.md`).

---

## 4. Relacionamentos

| Relação | Cardinalidade |
|---|---|
| Category → Transaction | 1:N |
| Category → Recurrence | 1:N |
| PaymentMethod → Transaction | 1:N |
| PaymentMethod → Recurrence | 1:N |
| PaymentMethod (`CREDIT_CARD`) ↔ CreditCard | 1:1 |
| CreditCard → Invoice | 1:N |
| CreditCard → InstallmentPlan | 1:N |
| Invoice → Transaction (lançamentos de cartão) | 1:N |
| Invoice → RefundAllocation (créditos reconhecidos) | 1:N |
| Invoice → Invoice (saldo credor transferido) | N:1 |
| InstallmentPlan → Installment | 1:N |
| Installment ↔ Transaction | 1:1 |
| Recurrence → Transaction (ocorrências geradas) | 1:N |
| Recurrence → RecurrenceException | 1:N |
| Refund → RefundAllocation | 1:N |
| Transaction → RefundAllocation (como alvo) | 1:N |

---

## 5. Enumerações canônicas

Valores persistidos em inglês e ASCII; labels da UI em português.

| Enum | Valor persistido | Significado | Label na UI |
|---|---|---|---|
| `CategoryType` | `INCOME` | Categoria de entrada | Entrada |
| | `EXPENSE` | Categoria de saída | Saída |
| `PaymentMethodSource` | `SYSTEM` | Fornecido pelo sistema | Sistema |
| | `USER` | Criado pelo usuário | Personalizado |
| `PaymentMethodKind` | `STANDARD` | Método comum | Comum |
| | `CREDIT_CARD` | Cartão de crédito (com `CreditCard`) | Cartão de crédito |
| `TransactionStatus` | `PENDING` | Não liquidado | Em aberto |
| | `PAID` | Liquidado | Pago |
| `TransactionOrigin` | `MANUAL` | Criado pelo usuário com método comum | Manual |
| | `CREDIT_CARD` | Compra à vista no cartão | Compra no cartão |
| | `INSTALLMENT` | Parcela de compra parcelada | Parcela |
| | `RECURRENCE` | Ocorrência de recorrência | Recorrência |
| `FinancialPeriodStatus` | `OPEN` | Mês aberto | Aberto |
| | `CLOSED` | Mês fechado (imutável) | Fechado |
| `InvoiceStatus` | `OPEN` | Ciclo em andamento | Aberta |
| | `CLOSED` | Ciclo encerrado, não paga | Fechada |
| | `PAID` | Paga (final) | Paga |
| `RecurrenceStatus` | `ACTIVE` | Gera ocorrências | Ativa |
| | `PAUSED` | Pausa vigente | Pausada |
| | `CANCELLED` | Encerrada definitivamente | Cancelada |
| `RefundStrategy` | `FIRST_INSTALLMENTS` | Crédito a partir da primeira parcela | Primeiras parcelas |
| | `LAST_INSTALLMENTS` | Crédito a partir da última parcela | Últimas parcelas |
| | `PROPORTIONAL` | Crédito proporcional entre as parcelas | Proporcional |

Situações **derivadas** (não persistidas):

| Situação | Regra | Label |
|---|---|---|
| Fatura atrasada | `CLOSED` e `due_date` < hoje (qualquer valor a pagar) | Atrasada |
| Ciclo sem fatura | ciclo projetado sem persistência | Sem lançamentos |
| Compra estornada | total estornado = valor original / > 0 | Estornada / Parcialmente estornada |
| Ocorrência pulada | existe `RecurrenceException` para o mês | Pulada |
| Compra tardia | `purchase_date` anterior ao início do ciclo da fatura de postagem | Compra de ciclo anterior |

Estados ativo/inativo de categoria e método são booleanos (`active`); labels: Ativa/Inativa, Ativo/Inativo.

Não existem: `REFUND` como origem, tipo de estorno `TOTAL`/`PARCIAL` persistido, enum de frequência de recorrência (somente mensal), tipo de exceção de recorrência, estado `OVERDUE` persistido.

---

## 6. Invariantes fundamentais

1. **Saldo previsto** = Entradas previstas − Saídas previstas; independe do status (`specs/home.md`).
2. **Natureza** de todo lançamento = tipo da categoria.
3. **Mês financeiro**: método comum → mês do `due_date`; cartão → `reference_month` da fatura de postagem; nunca `mês(due_date)` para cartão (`specs/financial-periods.md` §3).
4. **Ciclo do cartão** é determinado somente pela `purchase_date` e pelo `closing_date` (gravado ou calculado) (`specs/credit-cards.md` §6–§8).
5. **Fatura paga** nunca é reaberta nem modificada; compra tardia vai para a próxima fatura não paga.
6. **Pagamento de fatura** é a única forma de liquidar lançamentos de cartão e não cria lançamento.
7. **Parcelas** somam exatamente o total; não há transação-mãe.
8. **Estorno** não altera a compra original, nunca ultrapassa o valor original e não é lançamento.
9. **Saldo credor** é atributo da fatura, transferido para a próxima fatura não paga (`OPEN` ou `CLOSED`), sem efeito no planejamento.
10. **Recorrência** altera somente ocorrências ainda não geradas.
11. **Mês fechado** é imutável; o fechamento é irreversível, cronológico em relação aos meses anteriores com lançamentos e não se aplica a meses futuros.
12. **Configuração futura** (categoria, método, cartão, recorrência) nunca reescreve histórico.
13. **Nada é excluído** se comprometer o histórico: categorias, métodos, cartões, faturas e meses fechados não têm exclusão. Exclusão física existe, de forma provisória (PD-38), para lançamentos, compras de cartão e compras parceladas inteiras em mês aberto e fatura não `PAID` (com seus estornos), e para ocorrências de recorrência (substituídas por `RecurrenceException`). No futuro será privilégio de super admin.
14. **Valores monetários** em centavos inteiros.
15. **Isolamento por usuário**: toda entidade pertence a um usuário; um usuário não lê, referencia nem altera dados de outro (PD-40). A exclusão da conta apaga todos os dados do usuário, exceção explícita ao invariante 13.

---

## 7. Fora do modelo do MVP

Saldo bancário realizado, contas bancárias, transferências, conciliação, orçamento por categoria, limite de crédito, juros e encargos, pagamento parcial de fatura, papéis e compartilhamento de dados entre usuários.
