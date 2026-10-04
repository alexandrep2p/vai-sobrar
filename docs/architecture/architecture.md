# Arquitetura — Vai Sobrar

## 1. Objetivo

Definir a arquitetura técnica do Vai Sobrar, mantendo separadas regras de negócio, casos de uso, apresentação, persistência e infraestrutura.

O modelo de domínio (`docs/domain/domain-model.md`) e as feature specs (`docs/specs/`) são a fonte de verdade do comportamento funcional. Este documento define **como** esse comportamento é implementado e quais contratos técnicos devem existir. Nenhuma decisão de implementação pode alterar silenciosamente uma regra de negócio.

---

## 2. Stack

* **Frontend:** Angular 22 + Angular Material (tema Azure & Blue), mobile first
* **Backend:** Node.js + Express
* **Linguagem:** TypeScript (frontend e backend)
* **Banco:** PostgreSQL
* **ORM:** Prisma
* **Validação de entrada:** Zod
* **Testes:** Vitest
* **API:** REST

---

## 3. Repositório

```text
vai-sobrar/
├── docs/
│   ├── product/        prd.md
│   ├── domain/         domain-model.md
│   ├── architecture/   architecture.md
│   ├── specs/          categories, payment-methods, credit-cards, invoices,
│   │                   installments, refunds, recurrences, transactions,
│   │                   financial-periods, home
│   └── decisions/      business-decisions.md
├── tasks/
├── frontend/           Angular 22
└── backend/
    ├── src/
    ├── prisma/
    └── package.json
```

A documentação é versionada junto ao código.

---

## 4. Princípios

* **Backend como autoridade financeira.** Cálculos e validações críticas ficam no backend; o frontend não é fonte de regra.
* **Domínio independente.** Regras não dependem de Angular, Express, Prisma ou PostgreSQL. O domínio não usa modelos gerados pelo Prisma.
* **Operações atômicas.** Operações que alteram várias entidades usam transação de banco.
* **Histórico preservado.** Configuração futura nunca reescreve fatos registrados.
* **Valores exatos.** Dinheiro em **centavos inteiros**; nunca `float`.
* **Regra normativa única.** Cada regra de cálculo tem uma única implementação no domínio, espelhando a fonte normativa única na documentação (ver §9).

---

## 5. Frontend

Responsável por renderização, navegação entre meses, formulários, estado de interface, exibição do extrato, faturas e cadastros, ações (pagar, fechar, estornar, pular), apresentação de valores e labels, validações básicas e apresentação de erros da API.

O frontend não calcula saldo, fatura, ciclo, parcelas, centavos, estornos, elegibilidade de recorrência nem pré-condições de fechamento. Ele exibe o que o backend retorna e traduz enums para labels (`domain-model.md` §5).

---

## 6. Backend

O Express cuida da camada HTTP e da composição. Regras não ficam nos handlers.

Organização por módulos:

```text
backend/src/
├── modules/
│   ├── categories/
│   ├── payment-methods/
│   ├── credit-cards/
│   ├── invoices/
│   ├── transactions/
│   ├── installments/
│   ├── refunds/
│   ├── recurrences/
│   ├── financial-periods/
│   └── monthly-statement/
├── domain/              regras puras compartilhadas (ver §9)
├── shared/
└── app.ts
```

A estrutura interna de cada módulo (controller, service, repository, schema, types) pode variar.

### 6.1 Camadas

| Camada | Responsabilidade |
|---|---|
| Apresentação (Angular) | interface, estado visual, navegação |
| API (Express) | HTTP, parsing, validação de entrada (Zod), serialização, tratamento de erros |
| Aplicação | casos de uso que coordenam operações e transações de banco |
| Domínio | regras puras: ciclo, centavos, estorno, elegibilidade, fechamento, imutabilidade |
| Persistência (Prisma + PostgreSQL) | armazenamento, consultas, constraints, migrations |

Fluxo: `HTTP → Zod → Controller → Caso de uso → Domínio → Repository → PostgreSQL`.

O Zod valida formato, tipos, obrigatoriedade e limites estruturais. Regras que dependem de estado (mês fechado, fatura paga, saldo estornável, uso de categoria) ficam no caso de uso ou no domínio.

---

## 7. Persistência

Tabelas esperadas, derivadas de `domain-model.md` §3:

```text
financial_periods
categories
payment_methods
credit_cards
invoices
transactions
installment_plans
installments
recurrences
recurrence_exceptions
refunds
refund_allocations
```

### 7.1 Constraints relevantes

| Tabela | Constraint |
|---|---|
| `financial_periods` | `reference_month` único |
| `categories` | nome único sem diferenciar maiúsculas/minúsculas |
| `payment_methods` | nome único sem diferenciar maiúsculas/minúsculas (todos os métodos) |
| `credit_cards` | `payment_method_id` único; dias entre 1 e 31 |
| `invoices` | `(credit_card_id, reference_month)` único; `due_date > closing_date` |
| `installments` | `transaction_id` único; `(installment_plan_id, number)` único |
| `installment_plans` | `installment_count >= 2` |
| `transactions` | `amount > 0`; `(recurrence_id, occurrence_month)` único quando `origin = RECURRENCE`; `paid_at` nulo se e somente se `status = PENDING` |
| `recurrence_exceptions` | `(recurrence_id, occurrence_month)` único |
| `refunds` | exatamente um entre `transaction_id` e `installment_plan_id`; `strategy` obrigatória se e somente se houver `installment_plan_id`; `amount > 0` |
| `refund_allocations` | `amount > 0` |

Enums persistidos em ASCII (`domain-model.md` §5); o Prisma exige identificadores ASCII.

### 7.2 Persistência sob demanda

* **Meses:** `financial_periods` só guarda meses que precisaram de registro, no mínimo os fechados. Mês sem registro é `OPEN`.
* **Faturas:** criadas somente com o primeiro lançamento ou crédito (DEC-04).
* **Ocorrências:** projetadas até serem geradas (§12).

Consequência: lançamentos guardam `financial_month` (`YYYY-MM`) em vez de uma FK obrigatória para `financial_periods`.

---

## 8. Valores monetários

* Centavos inteiros em todo o domínio e na persistência.
* Distribuição de centavos: regra única de `installments.md` §6 (piso para todos e resto nas últimas posições), usada por parcelas e pela estratégia `PROPORTIONAL` de estorno.

---

## 9. Regras de domínio centralizadas

Para evitar versões divergentes, o domínio expõe funções puras únicas:

| Função | Fonte normativa |
|---|---|
| `effectiveDay(day, month)` — ajuste para o último dia válido | `credit-cards.md` §5 |
| `closingDate(card, month, persistedInvoice?)` | `credit-cards.md` §6.1–§6.2 |
| `dueDate(card, closingDate)` | `credit-cards.md` §6.3 |
| `cycleOf(card, purchaseDate, invoices)` | `credit-cards.md` §8.1 |
| `postingInvoice(card, purchaseDate, invoices, periods)` — inclui compra tardia | `credit-cards.md` §8.2 |
| `splitCents(total, n)` | `installments.md` §6 |
| `allocateRefund(target, amount, strategy, allocations)` | `refunds.md` §7 |
| `recognitionInvoice(allocation, refundDate, …)` | `refunds.md` §8 |
| `invoiceTotals(invoice)` — débitos, créditos, crédito recebido, valor a pagar, saldo credor | `invoices.md` §7–§8 |
| `financialMonth(item)` | `financial-periods.md` §3 |
| `occurrenceEligibility(recurrence, month, state)` | `recurrences.md` §5 |
| `canClose(month)` | `financial-periods.md` §4.1 |

Nenhum outro ponto do código recalcula essas regras.

---

## 10. Fluxo da Home

```text
GET /api/monthly-statement?month=YYYY-MM
  ├── estado do mês (registro ou OPEN lógico)
  ├── lançamentos persistidos com financial_month = mês
  ├── ocorrências projetadas de recorrências elegíveis no mês (não persistidas)
  ├── alocações de estorno reconhecidas em faturas com reference_month = mês
  ├── totais: entradas, saídas (− estornos), saldo previsto
  └── resposta consolidada
```

Cada item da resposta contém: tipo de item (lançamento, ocorrência projetada, crédito de estorno), data de exibição, descrição, valor, natureza, status (quando aplicável), categoria, método, origem e, quando aplicável, cartão, fatura (`reference_month`, `due_date`, status), `purchase_date`, parcela (`number`/`installment_count`, `installment_plan_id`) e compra original do estorno.

Data de exibição: `due_date` para método comum, `purchase_date` para itens de cartão, `refund_date` para créditos de estorno (`home.md` §3.1). Ordenação pela data de exibição.

---

## 11. Cartão e faturas

### 11.1 Postagem de lançamento de cartão

```text
purchase_date → cycleOf → fatura do ciclo
   ├── não PAID e mês aberto → postar
   └── PAID ou mês fechado   → próxima fatura não paga com mês aberto (compra tardia)
fatura inexistente → criar OPEN com closing_date/due_date calculados → CLOSED se closing_date < hoje
transaction.financial_month = invoice.reference_month
transaction.due_date        = invoice.due_date
```

### 11.2 Transição de estados

`OPEN → CLOSED` depende só da data e do `closing_date`. O status é persistido e precisa estar correto em qualquer leitura ou escrita. O mecanismo (rotina agendada, avaliação ao acessar, ou ambos) é decisão técnica aberta (§26), desde que o resultado seja determinístico e idempotente.

O mesmo mecanismo cobre `PAUSED ⇄ ACTIVE` de recorrências com pausa programada e a geração de ocorrências na data (§12).

### 11.3 Pagamento de fatura

```text
POST /api/invoices/:id/pay   { paid_at, payment_method_id }
  ├── status = OPEN ou CLOSED (não PAID)
  ├── mês do reference_month aberto
  ├── paid_at válido, <= hoje, fora de mês fechado
  ├── método ativo e diferente do método do próprio cartão
  ├── lançamentos PENDING → PAID (paid_at)
  ├── invoice → PAID (paid_at, payment_method_id)
  └── credit_balance apurado e transferido para a próxima fatura não paga (OPEN ou CLOSED) do cartão
(transação de banco única; nenhum lançamento é criado)
```

### 11.4 Saldo credor

* No pagamento: `credit_balance = max(0, créditos + crédito_recebido − débitos)`.
* Transferência para a próxima fatura não paga do mesmo cartão (`credit_transferred_to_invoice_id`). Se ela não existir, a transferência fica pendente e é vinculada quando uma fatura de ciclo posterior for criada.

---

## 12. Recorrências

* **Projeção:** para meses futuros, ocorrências elegíveis e ainda não geradas são calculadas a partir da configuração atual, sem persistência.
* **Geração:** a ocorrência é persistida na sua data (data ≤ hoje) ou antes, quando o usuário interage com ela. A geração na data deve ser garantida independentemente do acesso do usuário e deve avaliar a elegibilidade com o estado vigente **na data da ocorrência** (inclusive método e categoria ativos). A técnica para isso (rotina diária, histórico de ativação ou ambos) é decisão técnica aberta (§26).
* **Idempotência:** `(recurrence_id, occurrence_month)` é único entre ocorrências e exceções.
* **Alterações** na recorrência nunca atualizam ocorrências geradas.
* **Ocorrência de cartão gerada** é postada como compra de cartão (§11.1) com `purchase_date` = data da ocorrência.

---

## 13. Parcelamento

Criação em uma única transação: plano → `splitCents` → postagem da parcela 1 (§11.1) → parcelas seguintes nos ciclos subsequentes → faturas necessárias → transações e `installments`. Se qualquer etapa falhar, nada é criado (sem plano sem parcelas, parcela sem lançamento ou parcela sem fatura).

---

## 14. Estornos

```text
POST /api/refunds   { transaction_id | installment_plan_id, amount, refund_date, strategy? }
  ├── alvo é compra de cartão
  ├── amount <= saldo estornável (rejeita acima)
  ├── purchase_date <= refund_date <= hoje
  ├── allocateRefund (estratégia, limite por parcela, centavos)
  ├── recognitionInvoice por alocação (fatura do alvo ou fatura do estorno)
  └── persiste Refund + RefundAllocations (+ faturas criadas)
(transação de banco única; a compra original não é alterada)
```

---

## 15. Fechamento de mês

```text
POST /api/financial-periods/:month/close
  ├── mês OPEN
  ├── mês não é futuro (mês corrente pode ser fechado antes do último dia)
  ├── todo mês anterior que possua lançamentos está fechado
  ├── nenhum lançamento PENDING e nenhuma ocorrência projetada no mês
  ├── todas as faturas com reference_month = mês estão PAID (inclusive só com créditos)
  ├── persiste/atualiza o registro: CLOSED, closed_at
(transação de banco; sem reabertura)
```

---

## 16. Integridade de mês fechado

Toda operação que possa afetar um mês é validada no backend contra o estado do mês: criação, edição, exclusão, mudança de status, mudança de data (origem e destino), postagem em fatura, reconhecimento de estorno, pagamento de fatura, geração, projeção e exceção de recorrência. O frontend pode esconder ações, mas isso não substitui a validação.

---

## 17. Histórico versus configuração

| Configuração | Efeito |
|---|---|
| Nome de categoria ou método | mesmo identificador; histórico intacto |
| Desativação | só impede usos futuros |
| Melhor dia e vencimento do cartão | só ciclos sem fatura persistida |
| Recorrência | só ocorrências não geradas |
| Compra parcelada | imutável |
| Fatura persistida | `closing_date` e `due_date` nunca recalculados |

---

## 18. API

Os contratos finais (DTOs) são definidos nas tasks; os recursos abaixo devem existir. Não existe `DELETE` para categorias, métodos, cartões, faturas, planos, parcelas, recorrências nem meses.

### 18.1 Categorias

```text
GET  /api/categories
POST /api/categories
PUT  /api/categories/:id                 (nome; tipo somente se a categoria não tiver uso)
POST /api/categories/:id/activate
POST /api/categories/:id/deactivate
```

### 18.2 Métodos de pagamento

```text
GET  /api/payment-methods
POST /api/payment-methods                (cria somente kind = STANDARD)
PUT  /api/payment-methods/:id            (nome; somente USER + STANDARD)
POST /api/payment-methods/:id/activate
POST /api/payment-methods/:id/deactivate
```

### 18.3 Cartões

```text
GET  /api/credit-cards
GET  /api/credit-cards/:id
POST /api/credit-cards                   (cria PaymentMethod CREDIT_CARD + CreditCard)
PUT  /api/credit-cards/:id               (nome, best_purchase_day, due_day)
POST /api/credit-cards/:id/activate      (atua em PaymentMethod.active)
POST /api/credit-cards/:id/deactivate
```

### 18.4 Faturas

```text
GET  /api/credit-cards/:id/invoices?from=YYYY-MM&to=YYYY-MM   (persistidas + ciclos projetados vazios)
GET  /api/invoices/:id
POST /api/invoices/:id/pay               { paid_at, payment_method_id }
```

### 18.5 Lançamentos

```text
GET    /api/transactions
GET    /api/transactions/:id
POST   /api/transactions                 (manual, compra à vista no cartão ou compra parcelada com installment_count >= 2)
PUT    /api/transactions/:id             (campos conforme matriz de transactions.md §12)
POST   /api/transactions/:id/pay         { paid_at }   (somente método comum; cartão é liquidado pela fatura)
POST   /api/transactions/:id/unpay                  (somente método comum)
DELETE /api/transactions/:id             (somente MANUAL em mês aberto)
```

### 18.6 Parcelamentos

```text
GET /api/installment-plans/:id
PUT /api/installment-plans/:id           (descrição e categoria; ver installments.md §9)
```

### 18.7 Estornos

```text
POST /api/refunds
GET  /api/refunds/:id
GET  /api/transactions/:id/refunds
GET  /api/installment-plans/:id/refunds
```

### 18.8 Recorrências

```text
GET  /api/recurrences
GET  /api/recurrences/:id
POST /api/recurrences
PUT  /api/recurrences/:id
POST /api/recurrences/:id/pause          { paused_from, paused_until? }
POST /api/recurrences/:id/resume
POST /api/recurrences/:id/cancel
POST /api/recurrences/:id/occurrences/:month/skip
PUT  /api/recurrences/:id/occurrences/:month       (edição individual; gera a ocorrência se projetada)
POST /api/recurrences/:id/occurrences/:month/pay   { paid_at }   (somente método comum)
```

### 18.9 Extrato e meses

```text
GET  /api/monthly-statement?month=YYYY-MM
GET  /api/financial-periods/:month
POST /api/financial-periods/:month/close
```

---

## 19. Transações de banco

Operações atômicas obrigatórias: cadastro de cartão; compra à vista (com criação de fatura); compra parcelada; pagamento de fatura (com transferência de saldo credor); estorno; geração de ocorrência; pular ocorrência; fechamento de mês. Se uma etapa falhar, tudo é revertido.

---

## 20. Concorrência

Devem ser protegidos, com o mecanismo do PostgreSQL/Prisma escolhido por caso de uso:

* dois pagamentos da mesma fatura;
* pagamento de fatura concorrente com nova postagem ou novo crédito na mesma fatura;
* dois fechamentos do mesmo mês, ou fechamento concorrente com alteração no mês;
* dois estornos simultâneos da mesma compra (limite estornável);
* geração duplicada de ocorrência;
* criação duplicada de fatura para o mesmo cartão e mês.

---

## 21. Testes

Prioridade dos testes automatizados no backend:

1. saldo previsto e independência do status;
2. natureza pela categoria;
3. ajuste de dias, ciclo, `closing_date`, `due_date` e `reference_month`;
4. fatura de postagem, compra retroativa e compra tardia;
5. distribuição de centavos;
6. parcelas e faturas;
7. estados e pagamento da fatura; saldo credor;
8. estornos (estratégias, limites, reconhecimento);
9. recorrências (projeção, geração, alterações, pausa, cancelamento, exceção, inativos);
10. fechamento cronológico e imutabilidade;
11. preservação de configuração histórica.

---

## 22. Segurança e usuários

* O MVP é **single-user**. Não há autenticação, autorização, multiusuário, compartilhamento nem tenancy.
* A modelagem pode receber `user_id` no futuro, mas o MVP não o implementa.
* O backend valida todos os dados recebidos, não confia em cálculos do frontend, usa o Prisma de forma segura e mantém segredos em variáveis de ambiente.

---

## 23. Erros de negócio

O backend retorna erros estruturados. Códigos esperados (refináveis na implementação):

```text
PERIOD_CLOSED
PERIOD_HAS_PENDING_TRANSACTIONS
PERIOD_HAS_UNPAID_INVOICES
PERIOD_PREVIOUS_NOT_CLOSED
PERIOD_FUTURE_NOT_CLOSABLE
TRANSACTION_NOT_FOUND
TRANSACTION_NOT_EDITABLE
TRANSACTION_NOT_DELETABLE
CATEGORY_INACTIVE
CATEGORY_TYPE_MISMATCH
CATEGORY_TYPE_LOCKED
PAYMENT_METHOD_INACTIVE
PAYMENT_METHOD_NOT_EDITABLE
CARD_INACTIVE
INVOICE_ALREADY_PAID
INVOICE_PAYMENT_METHOD_INVALID
INVOICE_NOT_OPEN_FOR_CREDIT
CARD_TRANSACTION_SETTLED_BY_INVOICE
INVALID_PAYMENT_DATE
INVALID_PURCHASE_DATE
INVALID_INSTALLMENT_OPERATION
REFUND_TARGET_NOT_ALLOWED
REFUND_EXCEEDS_REMAINING_AMOUNT
INVALID_REFUND_DATE
RECURRENCE_OCCURRENCE_NOT_SKIPPABLE
RECURRENCE_CANCELLED
```

O frontend apresenta mensagens próprias e não depende do texto interno dos erros.

---

## 24. Evolução

Mudanças relevantes seguem a ordem: registrar a decisão em `docs/decisions/` → PRD (escopo) → Domain Model (conceitos) → spec normativa → testes → implementação. Nenhuma funcionalidade altera silenciosamente uma regra documentada.

O agente de programação recebe uma task pequena por vez, com os documentos fonte indicados. Diante de ambiguidade, ele interrompe aquela decisão, solicita definição, a documentação é atualizada e só então a implementação continua.

---

## 25. Decisões arquiteturais fechadas

Angular 22 com Angular Material (tema Azure & Blue, interface mobile first), Node.js + Express, TypeScript, PostgreSQL, Prisma, Zod, Vitest, REST; backend por módulos; backend como autoridade financeira; centavos inteiros; regras de domínio centralizadas (§9); transações de banco para operações compostas; mês financeiro lógico com registro sob demanda; fatura persistida somente com conteúdo e com ciclo gravado; recorrência com projeção e geração na data ou por interação; enums ASCII em inglês; single-user.

---

## 26. Decisões técnicas abertas

Podem ser definidas na task correspondente, sem alterar regras de negócio:

* mecanismo de transição de status por tempo (fatura `OPEN → CLOSED`, pausa de recorrência) e de geração de ocorrências na data: rotina agendada, avaliação ao acessar ou ambos;
* técnica para avaliar "ativo na data da ocorrência" (geração pontual ou histórico de ativação);
* mecanismo de lock por operação;
* formato final dos DTOs e versionamento da API;
* logging, observabilidade, cache, paginação, deploy e ambientes.

---

## 27. Fora da arquitetura do MVP

Open Banking, conciliação, sincronização bancária, notificações, limite de crédito, motor de juros, investimentos, orçamento por categoria, transferências e multiusuário.
