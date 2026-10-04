# Registro de Decisões de Negócio — Vai Sobrar

## Como usar este registro

* Este arquivo é o **histórico** das decisões de negócio. A regra operacional vigente está sempre na **fonte normativa** indicada em cada decisão (`docs/domain/` e `docs/specs/`).
* Se houver divergência entre este registro e uma spec, a divergência é um defeito de documentação e deve ser corrigida nos dois lugares.
* Novas decisões recebem um ID, são registradas aqui e propagadas para a fonte normativa antes de qualquer implementação.

Prefixos:

| Prefixo | Significado |
|---|---|
| `DEC-xx` | Decisões da primeira rodada de definição |
| `PD-xx` | Decisões da revisão cruzada (pendências resolvidas) |
| `CD-xx` | Consequências diretas de decisões já tomadas, registradas para transparência |
| `Q-xx` | Pendências abertas que exigem decisão do produto |

Status: **Vigente**, **Ampliada** (vigente, com escopo detalhado por decisão posterior), **Substituída**.

---

## 1. Decisões DEC

### DEC-01 — Mês financeiro de lançamentos de cartão
* **Status:** Vigente.
* **Decisão:** o mês financeiro de compras, parcelas e ocorrências de cartão é o mês de referência da fatura em que estão postadas.
* **Regra:** `financial_month = invoice.reference_month`; a `purchase_date` é preservada como dado histórico.
* **Impacto:** a Home e o fechamento usam o mês da fatura; para cartão, o mês nunca é derivado do vencimento.
* **Fonte:** `financial-periods.md` §3; `credit-cards.md` §7.

### DEC-02 — Parcelamento sem transação-mãe
* **Status:** Vigente.
* **Decisão:** cada parcela é uma `Transaction` ligada 1:1 a um `Installment`; o `InstallmentPlan` é apenas metadado.
* **Regra:** não existe transação com o valor total da compra parcelada.
* **Impacto:** o impacto financeiro vem somente das parcelas.
* **Fonte:** `installments.md` §2.

### DEC-03 — Alteração do vencimento
* **Status:** Ampliada por PD-14.
* **Decisão:** com o mês aberto, o `due_date` pode ir para frente ou para trás, desde que o mês de destino esteja aberto.
* **Regra:** vale para lançamentos com método comum; lançamentos de cartão têm `due_date` derivado da fatura.
* **Impacto:** mover o vencimento pode mudar o mês financeiro.
* **Fonte:** `transactions.md` §11.

### DEC-04 — Faturas vazias não são persistidas
* **Status:** Vigente.
* **Decisão:** ciclos sem conteúdo são apenas projetados; a fatura nasce com o primeiro lançamento ou crédito, com status `OPEN`.
* **Regra:** a interface exibe ciclos vazios como "Sem lançamentos — R$ 0,00".
* **Impacto:** sem faturas vazias no banco; criação sob demanda.
* **Fonte:** `invoices.md` §4.

### DEC-05 — Recorrência com cartão desativado
* **Status:** Ampliada por PD-10.
* **Decisão:** a recorrência permanece `ACTIVE`; a geração é bloqueada enquanto o cartão estiver inativo; sem retroatividade na reativação.
* **Fonte:** `recurrences.md` §14.

### DEC-06 — Compra retroativa em fatura fechada
* **Status:** Vigente para compras. Para créditos de estorno, restringida pela PD-23: fatura `CLOSED` não recebe crédito.
* **Decisão:** `CLOSED` encerra o ciclo normal, mas não torna a fatura imutável. Compra com `purchase_date` dentro do ciclo pode ser postada em fatura `CLOSED` não paga, com o mês aberto.
* **Fonte:** `credit-cards.md` §8; `invoices.md` §5.1.

### DEC-07 — Rollover de crédito como transação `REFUND`
* **Status:** **Substituída por PD-05.**
* **Motivo:** representar o excedente como lançamento gerava risco de contagem dupla. O excedente agora é saldo credor da fatura.

### DEC-08 — Dados de pagamento na fatura
* **Status:** Ampliada por PD-07.
* **Decisão:** `paid_at` e `payment_method_id` do pagamento ficam na `Invoice`.
* **Fonte:** `invoices.md` §3 e §9.

### DEC-09 — Exclusão física somente de lançamentos manuais
* **Status:** Ampliada por PD-28.
* **Decisão:** somente lançamentos `MANUAL` em mês aberto podem ser excluídos fisicamente.
* **Impacto:** compras de cartão usam estorno; ocorrências de recorrência usam "pular ocorrência", que remove fisicamente a ocorrência com método comum e `PENDING` (PD-28).
* **Fonte:** `transactions.md` §13.

---

## 2. Decisões PD

### PD-01 — Vencimento da fatura e mês de referência
* **Decisão:** o `reference_month` é o mês em que as compras do ciclo são contabilizadas. O vencimento ocorre depois do fechamento do ciclo.
* **Regra:**
  * `closing_date(M)` = dia efetivo do melhor dia no mês `M`;
  * `due_date` = primeira data com o dia de vencimento efetivo **estritamente posterior** ao `closing_date`;
  * a fatura nunca vence antes do fim do seu ciclo.
* **Impacto:**
  * O vencimento pode cair no mês seguinte ao `reference_month` (melhor dia 25, vencimento 5 → compra de 20/10 vence em 05/11 e impacta outubro).
  * O mês financeiro de cartão nunca é `mês(due_date)`.
* **Fonte:** `credit-cards.md` §6.

### PD-02 — Natureza do estorno
* **Decisão:** estorno de cartão é um crédito vinculado à compra original, representado por `Refund`. Não é categoria `INCOME`, e não existe categoria fixa "Estorno".
* **Regra:** a compra original mantém a sua categoria; o estorno não tem categoria.
* **Impacto:** ver CD-01.
* **Fonte:** `refunds.md` §2.

### PD-03 — Escopo do estorno
* **Decisão:**
  * somente compras de cartão (à vista, parcelada ou ocorrência de recorrência com cartão);
  * estorno total ou parcial, com múltiplos estornos até o valor original;
  * estratégias `FIRST_INSTALLMENTS`, `LAST_INSTALLMENTS` e `PROPORTIONAL`;
  * respeita os fechamentos.
* **Regra:** lançamentos com PIX, Dinheiro, Débito ou outros métodos comuns não são estornados; não há crédito negativo nem duplicado.
* **Impacto:** foram removidas as regras antigas de estorno de qualquer ocorrência de recorrência e a "janela de estorno" (CD-13).
* **Fonte:** `refunds.md` §3, §5 e §7.

### PD-04 — Estorno com alvo em fatura paga ou mês fechado
* **Decisão:** uma parcela ou compra em fatura paga ou em mês fechado não é alterada. O crédito é reconhecido no período/fatura do estorno.
* **Regra:** reconhecimento na fatura do alvo quando ela pode receber crédito; senão, na fatura do ciclo da `refund_date`.
* **Impacto:** CD-07 e CD-08. Pela PD-23, só fatura `OPEN` com mês aberto recebe crédito.
* **Fonte:** `refunds.md` §8.

### PD-05 — Crédito excedente (rollover)
* **Decisão:** o excedente é saldo credor da própria fatura, carregado para a próxima fatura e consumido antes do cálculo do valor a pagar. Não gera lançamento no extrato.
* **Regra:** `saldo_credor = max(0, créditos + crédito_recebido − débitos)`; `valor_a_pagar` nunca é negativo.
* **Impacto:** substitui a DEC-07; ver CD-05.
* **Fonte:** `invoices.md` §7–§8.

### PD-06 — Estados da fatura
* **Status:** Vigente; a regra de que só `CLOSED` pode ser paga foi alterada pela PD-32.
* **Decisão:** máquina de estados persistida `OPEN → CLOSED → PAID`.
* **Regra:**
  * `PAID` significa paga pela ação "Pagar fatura";
  * não existe `PAID → OPEN`/`CLOSED`;
  * a fatura vazia futura não é persistida;
  * nenhuma operação modifica fatura paga ou de mês fechado.
* **Impacto:** a fatura não passa a `PAID` por valor zero (CD-03, CD-04); lançamentos de cartão só são liquidados pela fatura (PD-24).
* **Fonte:** `invoices.md` §5.

### PD-07 — Pagamento da fatura
* **Decisão:** pagamento com data obrigatória e método ativo, exceto o próprio cartão. Liquida os lançamentos, registra data e método na fatura e não cria despesa. Sem pagamento parcial e sem desfazer.
* **Regra:** a data do pagamento é `Invoice.paid_at` (o termo "payment_date" usado na decisão corresponde a esse campo).
* **Impacto:** CD-09 e CD-10.
* **Fonte:** `invoices.md` §9.

### PD-08 — Home
* **Decisão:** a Home mostra o impacto no mês da fatura, com cada parcela e cada compra de cartão como item individual, sem transação-mãe; a parcela mostra `n/N` e dá acesso à compra original; a `purchase_date` fica disponível como histórico.
* **Regra:** não existe linha agregada por cartão ou fatura.
* **Impacto:** a data exibida para itens de cartão é a `purchase_date` (PD-25).
* **Fonte:** `home.md` §3.

### PD-09 — Recorrência com cartão
* **Decisão:** o `due_day` é o dia da cobrança. A ocorrência vai para a fatura do ciclo correspondente, e o mês financeiro é o mês da fatura. O valor da recorrência pode ser alterado sem afetar ocorrências geradas.
* **Regra:** a data da ocorrência funciona como `purchase_date`.
* **Impacto:** o valor de ocorrência de cartão gerada é editável enquanto a fatura não estiver `PAID` (PD-27).
* **Fonte:** `recurrences.md` §13.

### PD-10 — Método ou categoria inativos em recorrência
* **Decisão:** método (inclusive cartão) ou categoria inativos bloqueiam novas ocorrências, sem alterar a recorrência. Não há ocorrência retroativa; a retomada vale a partir do próximo ciclo elegível após a reativação.
* **Impacto:** CD-12.
* **Fonte:** `recurrences.md` §14; `categories.md` §6; `payment-methods.md` §7.

### PD-11 — Alterações na recorrência
* **Decisão:** alterações na regra afetam somente ocorrências futuras ainda não geradas. Ocorrências geradas não mudam automaticamente. A categoria pertence à recorrência.
* **Impacto:** foram removidas as regras de atualização automática de ocorrências já materializadas; ver CD-02.
* **Fonte:** `recurrences.md` §6, §8 e §9.

### PD-12 — Edição de compra parcelada
* **Decisão:** valor total, quantidade, cartão e data da compra são imutáveis. A descrição é editável com o mês aberto. A categoria só muda se todas as parcelas afetadas estiverem em meses abertos. Não há edição isolada de valor ou estrutura de parcela.
* **Impacto:** descrição e categoria seguem a mesma regra de bloqueio (PD-27); ver CD-15 e CD-21.
* **Fonte:** `installments.md` §8–§9.

### PD-13 — Ciclo de vida do mês financeiro
* **Decisão:** meses existem logicamente e estão abertos até o fechamento. O fechamento é manual, explícito, irreversível, exige todos os lançamentos `PAID` e é cronológico. Mês fechado é imutável, inclusive lançamentos, parcelas e faturas daquele mês. Recorrências e parcelamentos não são bloqueados pelo fechamento; importa o mês efetivamente afetado.
* **Impacto:** o detalhamento do fechamento cronológico está na PD-26.
* **Fonte:** `financial-periods.md`.

### PD-14 — Vencimento e pagamento
* **Decisão:** reforça a DEC-03. `paid_at` existe somente com `PAID`, é uma data válida e não pertence a mês fechado. Voltar de pago para pendente só é possível com o mês aberto.
* **Impacto:** CD-09.
* **Fonte:** `transactions.md` §8.1, §9 e §11.

### PD-15 — Enumerações
* **Decisão:** valores persistidos em inglês e ASCII; labels em português; booleanos para ativo/inativo; nenhum enum desnecessário.
* **Regra:** tabela única em `domain-model.md` §5. `CANCELLED` (dois L), `PENDING`/`PAID`, `INCOME`/`EXPENSE`.
* **Impacto:**
  * Removidos: `REFUND` (origem), `TOTAL`/`PARCIAL`, frequência, tipo de exceção de recorrência e `OVERDUE` persistido.
  * Criado: `PaymentMethodKind`.
* **Fonte:** `domain-model.md` §5.

### PD-16 — Alteração da configuração do cartão
* **Decisão:** alterar o melhor dia ou o vencimento não altera faturas existentes nem lançamentos postados; vale para ciclos ainda não vinculados a fatura.
* **Impacto:** CD-06.
* **Fonte:** `credit-cards.md` §12.

### PD-17 — Cartão e método de pagamento
* **Decisão:** `PaymentMethod` é o método selecionável; o cartão é especialização (`kind = CREDIT_CARD` + `CreditCard`). Não há método de crédito sem `CreditCard`. Estado ativo e nome têm fonte única.
* **Regra:** `name` e `active` só em `PaymentMethod`; `CreditCard` guarda `best_purchase_day` e `due_day`; cartão só é criado pelo fluxo de cartão.
* **Fonte:** `payment-methods.md` §2–§4; `credit-cards.md` §2–§3.

### PD-18 — Faixas de dias e parcelas
* **Decisão:** dias de 1 a 31, usando o último dia válido em meses curtos. Mínimo de 2 parcelas, sem máximo de negócio.
* **Impacto:** CD-16.
* **Fonte:** `credit-cards.md` §5; `installments.md` §4.1.

### PD-19 — Pular ocorrência
* **Decisão:** é possível pular uma ocorrência futura sem cancelar a recorrência, com registro explícito de exceção. Ocorrência paga não pode ser excluída.
* **Regra:** `RecurrenceException (recurrence_id, occurrence_month)`.
* **Impacto:** ocorrências geradas com método comum e `PENDING` também podem ser puladas (PD-28).
* **Fonte:** `recurrences.md` §10.

### PD-20 — Estados da recorrência
* **Decisão:** `ACTIVE`, `PAUSED` e `CANCELLED`. Pausa e cancelamento preservam o histórico. Não há estado adicional para cartão ou método inativo.
* **Regra:**
  * `PAUSED` enquanto a pausa está vigente (`paused_from`/`paused_until`);
  * atingir a `end_date` não muda o status.
* **Fonte:** `recurrences.md` §11–§12.

### PD-21 — Tipo de categoria
* **Decisão:** `INCOME`/`EXPENSE`, imutável depois de qualquer uso persistido (lançamento ou recorrência). Sem uso, a alteração é permitida.
* **Fonte:** `categories.md` §4.1.

### PD-22 — Usuário único
* **Decisão:** o MVP é single-user, sem autenticação, autorização, multiusuário ou tenancy. `user_id` pode existir no futuro.
* **Fonte:** `architecture.md` §22.

### PD-23 — Fatura `CLOSED` não recebe crédito de estorno (Q-01)
* **Decisão:** uma fatura `CLOSED` e ainda não paga não recebe crédito de estorno; o crédito vai para a fatura do período do estorno.
* **Regra:** só recebe crédito a fatura `OPEN` cujo mês está aberto. Se a fatura do ciclo da `refund_date` também não puder receber crédito, ele vai para a próxima fatura do cartão que possa (CD-20).
* **Impacto:** a fatura `CLOSED` continua aceitando compras do ciclo e compras tardias (DEC-06).
* **Fonte:** `refunds.md` §8; `invoices.md` §5.1.

### PD-24 — Lançamentos de cartão só são liquidados pela fatura (Q-02)
* **Decisão:** compras à vista, parcelas e ocorrências de recorrência com cartão não são pagas individualmente.
* **Regra:** ficam `PENDING` até a ação "Pagar fatura", que as torna `PAID` de forma definitiva.
* **Impacto:**
  * um mês só fecha com as faturas daquele mês pagas;
  * deixa de existir o caso de lançamento de cartão já pago antes da fatura.
* **Fonte:** `invoices.md` §9.3; `transactions.md` §9.

### PD-25 — Data exibida de itens de cartão (Q-03)
* **Decisão:** itens de cartão exibem no extrato a data da compra (`purchase_date`).
* **Regra:**
  * o item aparece no mês da fatura, mesmo com data de mês anterior;
  * as parcelas exibem a data da compra do plano;
  * créditos de estorno exibem a `refund_date` (CD-19).
* **Fonte:** `home.md` §3.1.

### PD-26 — Fechamento cronológico (Q-04)
* **Decisão:**
  * só bloqueiam o fechamento os meses anteriores que possuam lançamentos;
  * o mês corrente pode ser fechado antes do último dia;
  * meses futuros não podem ser fechados.
* **Regra:** alocações de estorno não contam como lançamento para esse fim. Depois de fechar o mês corrente antes do fim, novos lançamentos com data nele são rejeitados e compras de cartão do ciclo seguem a regra de compra tardia.
* **Fonte:** `financial-periods.md` §4.1.

### PD-27 — Edição de compras de cartão (Q-05)
* **Decisão:**
  * (a) descrição de parcelamento com parcela em mês fechado: edição bloqueada;
  * (b) `purchase_date` de compra à vista: não editável;
  * (c) descrição e categoria de lançamento postado em fatura `PAID`: não editáveis;
  * (d) valor de ocorrência de recorrência com cartão já gerada: editável.
* **Regra:**
  * lançamentos de fatura `PAID` não têm nenhum campo editável;
  * descrição e categoria de parcelamento só mudam com todas as parcelas em meses abertos e em faturas não pagas;
  * o valor de ocorrência de cartão só pode ser editado enquanto a fatura não estiver `PAID`.
* **Fonte:** `transactions.md` §12; `installments.md` §9; `credit-cards.md` §11; `recurrences.md` §9.

### PD-28 — Pular ocorrência já gerada (Q-06)
* **Decisão:** uma ocorrência de recorrência com método comum, já gerada e ainda em aberto, pode ser pulada.
* **Regra:**
  * o lançamento é removido fisicamente e substituído por `RecurrenceException` na mesma operação;
  * ocorrências pagas e ocorrências de cartão não podem ser puladas;
  * só em meses abertos.
* **Fonte:** `recurrences.md` §10; `transactions.md` §13.

### PD-29 — Fechamento exige faturas do mês pagas
* **Decisão:** um mês só fecha quando todas as faturas com aquele `reference_month` estão `PAID`, inclusive faturas que só têm créditos de estorno.
* **Regra:** faturas só com créditos são pagas pela ação "Pagar fatura" de R$ 0,00.
* **Impacto:** evita fatura `CLOSED` permanente em mês fechado e saldo credor que nunca é transferido.
* **Fonte:** `financial-periods.md` §4.1; `invoices.md` §9.3.

### PD-30 — Saldo credor pode ir para fatura `CLOSED`
* **Decisão:** o saldo credor vai para a próxima fatura não paga do cartão, seja `OPEN` ou `CLOSED`.
* **Regra:** a transferência reduz o valor a pagar da fatura de destino; não é crédito de estorno, e a PD-23 não se aplica.
* **Fonte:** `invoices.md` §8.

### PD-31 — Atraso independe do valor
* **Decisão:** fatura `CLOSED` com vencimento passado é apresentada como atrasada mesmo com R$ 0,00 a pagar, até ser paga.
* **Fonte:** `invoices.md` §6.

### PD-32 — Pagamento antecipado de fatura aberta
* **Status:** Vigente. Substitui a restrição de PD-06 / CD-03 de que somente fatura `CLOSED` podia ser paga.
* **Decisão:** a ação "Pagar fatura" é permitida com a fatura `OPEN` ou `CLOSED`, sem esperar o `closing_date`. O usuário ainda não pode fechar a fatura manualmente (não existe "fechar fatura").
* **Regra:**
  * `OPEN → PAID` e `CLOSED → PAID`, somente pela ação "Pagar fatura"; `PAID` continua final e nunca é reaberta;
  * a fatura paga mantém o `closing_date` gravado, mas não passa a `CLOSED` depois (a transição por tempo só vale para `OPEN`);
  * a compra cujo ciclo pertença a fatura `PAID` é postada na próxima fatura não paga (compra tardia, `credit-cards.md` §8.2). Exemplo: fatura de outubro (fecha em 06/10) paga em 03/10; compra de 05/10 entra na fatura de novembro, mantendo a `purchase_date` 05/10;
  * as demais pré-condições do pagamento não mudam (mês aberto, `paid_at` válido, método ativo e diferente do cartão);
  * o código de erro `INVOICE_NOT_CLOSED` deixa de existir.
* **Impacto:** o mês pode ser fechado assim que todos os lançamentos e faturas do mês estiverem pagos, inclusive antes do `closing_date` das faturas do cartão.
* **Fonte:** `invoices.md` §5 e §9.1; `credit-cards.md` §8.2; `financial-periods.md` §4.3.

---

## 3. Consequências registradas (CD)

Consequências diretas das decisões acima, aplicadas na documentação. Não introduzem regra nova; estão registradas para facilitar a revisão.

| ID | Consequência | Origem | Fonte |
|---|---|---|---|
| CD-01 | O estorno não é `Transaction`. Cada alocação aparece no extrato do mês da fatura de reconhecimento como linha de crédito e reduz as Saídas previstas (abatida da natureza da compra original). A origem `REFUND` deixa de existir. | PD-02 | `refunds.md` §9; `home.md` §2 |
| CD-02 | Uma ocorrência é "gerada" quando a sua data chega ou antes, quando o usuário a paga ou edita. Ocorrências futuras não geradas são projetadas da configuração atual. | PD-11 ("futuras ainda não geradas") | `recurrences.md` §6 |
| CD-03 | Fatura `OPEN` ou `CLOSED` pode ser paga; fatura `PAID` não. (Redação original — só `CLOSED` — substituída pela PD-32.) | PD-06, PD-32 | `invoices.md` §5 |
| CD-04 | Fatura com valor a pagar R$ 0,00 só passa a `PAID` pela ação "Pagar fatura". | PD-06, PD-07 | `invoices.md` §9.2 |
| CD-05 | O saldo credor é apurado quando a fatura passa a `PAID` e transferido para a próxima fatura não paga do mesmo cartão. | PD-05, PD-06 | `invoices.md` §8 |
| CD-06 | A fatura grava `closing_date`. O ciclo de fatura persistida usa o valor gravado; ciclos sem fatura usam a configuração vigente. | PD-16, PD-01 | `credit-cards.md` §6.2 |
| CD-07 | `refund_date` informada (`purchase_date ≤ refund_date ≤ hoje`). A "fatura do estorno" é a do ciclo da `refund_date` (ver CD-20 quando ela não puder receber crédito). | PD-03, PD-04 | `refunds.md` §6 e §8 |
| CD-08 | Crédito redirecionado continua atribuído à parcela-alvo e consome o saldo estornável dela. | PD-04 | `refunds.md` §8 |
| CD-09 | `paid_at` (lançamento e fatura) não pode ser futuro, pois registra pagamento efetivo, nem pertencer a mês fechado. | PD-07, PD-14 | `transactions.md` §8.1; `invoices.md` §9.1 |
| CD-10 | O pagamento de fatura aceita qualquer método ativo, inclusive outro cartão, exceto o próprio cartão. | PD-07 | `invoices.md` §9.1 |
| CD-11 | Pedido de estorno acima do saldo estornável é rejeitado, não reduzido. | PD-03 | `refunds.md` §5 |
| CD-12 | Após a reativação, voltam as ocorrências com data igual ou posterior à reativação. Projeções futuras usam o estado atual (inativo → não projeta). | PD-10 | `recurrences.md` §14 |
| CD-13 | A "janela de estorno" restrita ao mês corrente foi removida; o destino do crédito é resolvido por PD-04. | PD-03, PD-04 | `refunds.md` §8 |
| CD-14 | O método de lançamento comum só é trocado por outro método comum; trocar para ou de cartão criaria ou desfaria compra de cartão. | imutabilidade de compra de cartão | `transactions.md` §7 |
| CD-15 | Descrição e categoria da compra parcelada ficam nas transações das parcelas, sempre iguais entre si; o plano guarda só os dados imutáveis. | PD-12 | `installments.md` §3 |
| CD-16 | Limite técnico de 120 parcelas, documentado como restrição técnica. | PD-18 | `installments.md` §4.1 |
| CD-17 | Compra tardia é derivável (`purchase_date` anterior ao início do ciclo da fatura de postagem); não há campo próprio. | decisão de compra tardia | `credit-cards.md` §8.2 |
| CD-18 | `Transaction.financial_month` é persistido porque meses e faturas são materializados sob demanda. | PD-13, DEC-04 | `architecture.md` §7.2 |
| CD-19 | Créditos de estorno exibem a `refund_date` no extrato, por analogia à data da compra. | PD-25 | `home.md` §3.1 |
| CD-20 | Se a fatura do ciclo da `refund_date` não puder receber crédito (`CLOSED`, `PAID` ou mês fechado), o crédito vai para a próxima fatura `OPEN` do mesmo cartão, com mês aberto. | PD-23, PD-04 | `refunds.md` §8 |
| CD-21 | Depois que qualquer parcela está em fatura `PAID`, a descrição e a categoria do parcelamento não podem mais ser alteradas. | PD-12, PD-27 | `installments.md` §9 |
| CD-22 | O cancelamento de uma recorrência bloqueia as ocorrências com data igual ou posterior à data do cancelamento; as anteriores permanecem. | PD-19 | `recurrences.md` §12 |
| CD-23 | A pausa cobre as datas de `paused_from` até a véspera de `paused_until`; na data `paused_until` a recorrência volta a gerar ocorrências. | PD-10 | `recurrences.md` §11 |

### Decisão de compra tardia (confirmada nesta etapa)

* **Decisão:** compra cujo ciclo (pela `purchase_date`) pertence a fatura `PAID` ou a mês fechado é postada na próxima fatura não paga, com mês aberto, do mesmo cartão. A `purchase_date` original é preservada e a fatura paga não é alterada.
* **Regra:** o ciclo depende só da `purchase_date`; o cadastro tardio (`created_at`) não muda o ciclo.
* **Fonte:** `credit-cards.md` §8.

---

## 4. Pendências abertas (Q)

Não há pendências abertas. Q-01 a Q-06 foram resolvidas pelas PD-23 a PD-28. As lacunas da revisão final foram resolvidas pelas PD-29 a PD-31, e o pagamento antecipado de fatura aberta pela PD-32.
