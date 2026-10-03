# Spec — Estornos

## 1. Objetivo

Definir o mecanismo de estorno de compras de cartão de crédito.

Esta spec é a **fonte normativa** para:

* o que pode ser estornado;
* limites de valor;
* estratégias de distribuição em compras parceladas;
* em qual fatura e em qual mês cada crédito é reconhecido;
* como o crédito aparece no planejamento.

Regras referenciadas:

| Assunto | Fonte normativa |
|---|---|
| Ciclo e fatura de uma data (`refund_date`) | `credit-cards.md` §6 e §8 |
| Estados da fatura, totais e saldo credor | `invoices.md` |
| Distribuição determinística de centavos | `installments.md` §6 |
| Fechamento do mês | `financial-periods.md` |

---

## 2. Conceito

Estorno (`Refund`) é a reversão total ou parcial de uma **compra de cartão de crédito**.

* O estorno **não** exclui nem altera a compra original. Valor, categoria, fatura e status da compra permanecem como estavam.
* O estorno **não** é um lançamento (`Transaction`) e **não** possui categoria. Não existe categoria fixa "Estorno" e o estorno não é transformado em `INCOME`.
* O estorno é um **crédito sobre uma despesa de cartão**, vinculado à compra original e representado por `Refund` e suas alocações (`RefundAllocation`).

---

## 3. Alvos permitidos

Somente compras de cartão podem ser estornadas:

| Alvo | Representação |
|---|---|
| Compra à vista no cartão | `Transaction` com `origin = CREDIT_CARD` |
| Ocorrência de recorrência paga com cartão | `Transaction` com `origin = RECURRENCE` postada em fatura |
| Compra parcelada | `InstallmentPlan` (o estorno é sempre da compra, distribuído entre as parcelas) |

Não podem ser estornados lançamentos pagos com PIX, Dinheiro, Débito ou qualquer método que não seja cartão de crédito, inclusive ocorrências de recorrência que não sejam de cartão. Estornar uma ocorrência de recorrência de cartão não cancela nem altera a recorrência.

Uma parcela individual não é alvo de estorno: o alvo é o plano de parcelamento, e a estratégia define quais parcelas recebem o crédito.

---

## 4. Estrutura

```text
Refund
├── id
├── transaction_id          (alvo: compra à vista ou ocorrência de recorrência de cartão)
├── installment_plan_id     (alvo: compra parcelada)
├── amount                  (centavos, > 0)
├── refund_date             (data em que o estorno ocorreu)
├── strategy                (FIRST_INSTALLMENTS | LAST_INSTALLMENTS | PROPORTIONAL; somente para compra parcelada)
└── created_at

RefundAllocation
├── id
├── refund_id
├── transaction_id          (lançamento da compra ou da parcela que recebe o crédito)
├── amount                  (centavos, > 0)
├── invoice_id              (fatura em que o crédito é reconhecido)
└── created_at
```

* Exatamente um entre `transaction_id` e `installment_plan_id` é preenchido em `Refund`.
* `strategy` é obrigatória quando o alvo é um plano de parcelamento e ausente nos demais casos.
* A soma das alocações de um `Refund` é exatamente igual ao seu `amount`.
* O mês financeiro de uma alocação é o `reference_month` da fatura em que ela é reconhecida.
* Um estorno é imutável depois de registrado.

---

## 5. Limites de valor

```text
saldo_estornável(compra) = valor original da compra − Σ estornos anteriores da compra
```

* `amount` > 0.
* `amount` ≤ saldo estornável. Um pedido acima do saldo é **rejeitado** (não é reduzido automaticamente).
* Múltiplos estornos parciais são permitidos até o limite do valor original.
* Um estorno pode neutralizar totalmente a compra.

Por parcela:

```text
saldo_estornável(parcela) = valor original da parcela − Σ alocações já feitas na parcela
```

Nenhuma alocação ultrapassa o saldo estornável da parcela. Nunca existe crédito negativo nem duplicado.

"Estornada totalmente" e "estornada parcialmente" são situações derivadas da comparação entre o total estornado e o valor original; não são persistidas.

---

## 6. Data do estorno

`refund_date` é a data em que o estorno efetivamente ocorreu:

```text
purchase_date da compra <= refund_date <= hoje
```

---

## 7. Distribuição entre parcelas (compra parcelada)

O usuário escolhe uma estratégia no momento do estorno.

### 7.1 `FIRST_INSTALLMENTS` — Primeiras parcelas

Aloca a partir da parcela 1, em ordem crescente, até o saldo estornável de cada parcela.

```text
4x de R$ 100, estorno de R$ 150
1/4 → R$ 100
2/4 → R$ 50
3/4 → —
4/4 → —
```

### 7.2 `LAST_INSTALLMENTS` — Últimas parcelas

Aloca a partir da última parcela, em ordem decrescente.

```text
4x de R$ 100, estorno de R$ 150
1/4 → —
2/4 → —
3/4 → R$ 50
4/4 → R$ 100
```

### 7.3 `PROPORTIONAL` — Proporcional

Distribui entre todas as parcelas com saldo estornável, proporcionalmente a esse saldo (sem estornos anteriores, é o valor real de cada parcela, inclusive as que receberam centavos extras).

```text
3x de R$ 100, estorno de R$ 90 → R$ 30 / R$ 30 / R$ 30
```

Centavos: cada parcela recebe o piso da sua cota; os centavos restantes são somados, um a um, às **últimas** parcelas participantes, pela mesma regra determinística de `installments.md` §6. A soma das alocações é exatamente o valor estornado.

### 7.4 Compra à vista e ocorrência de recorrência

Uma única alocação, no próprio lançamento, sem estratégia.

---

## 8. Reconhecimento do crédito (normativo, PD-04)

Cada alocação é reconhecida em uma fatura:

1. **Fatura do lançamento-alvo.** Se a fatura em que a compra ou parcela está postada pode receber crédito, a alocação é reconhecida nela. Isso vale também para faturas futuras de parcelas futuras.
2. **Fatura do estorno.** Caso contrário, a alocação é reconhecida na fatura do ciclo da `refund_date`, determinada como se a `refund_date` fosse uma data de compra no mesmo cartão (`credit-cards.md` §8.1). Se essa fatura também não puder receber crédito, a alocação vai para a próxima fatura do mesmo cartão que possa recebê-lo, percorrendo os ciclos seguintes em ordem. Somente a fatura que efetivamente recebe a alocação é criada, se ainda não existir (`invoices.md` §4). Um ciclo sem fatura persistida cujo `closing_date` já passou é tratado como fatura que não pode receber crédito e é pulado, sem criar fatura vazia.

Uma fatura pode receber crédito somente quando (PD-23):

* está `OPEN`; e
* o seu `reference_month` é um mês financeiro aberto.

Faturas `CLOSED` (ciclo encerrado, ainda não pagas) e `PAID` **não** recebem crédito.

A atribuição à parcela não muda quando o reconhecimento é redirecionado: a alocação continua vinculada à parcela-alvo (e consome o saldo estornável dela), mas é reconhecida na fatura do estorno.

Exemplo — estorno tardio de compra à vista:

```text
Compra de R$ 300 em abril; fatura de abril PAID; abril FECHADO
Estorno de R$ 300 com refund_date em junho

→ fatura de abril não pode receber crédito
→ alocação reconhecida na fatura do ciclo de junho
→ abril permanece intacto
```

Exemplo — parcelado com primeira parcela já paga:

```text
4x de R$ 100; fatura da parcela 1/4 PAID
Estorno de R$ 150, FIRST_INSTALLMENTS

1/4 → R$ 100, reconhecido na fatura do estorno
2/4 → R$ 50, reconhecido na fatura da parcela 2/4 se ela estiver OPEN;
       senão, na fatura do estorno
```

Um estorno nunca reabre fatura, nunca altera mês fechado e nunca modifica o lançamento original.

---

## 9. Efeito no planejamento

* Cada alocação aparece no extrato do mês financeiro da fatura em que foi reconhecida, como uma linha de crédito vinculada à compra original (`home.md`).
* A alocação é abatida do total correspondente à natureza da categoria da compra original. Para uma compra de categoria `EXPENSE`, o crédito **reduz as Saídas previstas** daquele mês.
* O crédito é considerado liquidado: não possui status `PENDING`/`PAID`, não precisa ser pago e não bloqueia o fechamento do mês.
* Na fatura, as alocações entram em `créditos` (`invoices.md` §7). Se superarem os débitos, a fatura fica com saldo credor (`invoices.md` §8), que não gera novo efeito no planejamento.

Exemplo:

```text
Fatura e mês de outubro
Compra (EXPENSE)       R$ 500,00
Estorno               −R$ 200,00
Saídas previstas de outubro consideram R$ 300,00 líquidos
Valor a pagar da fatura: R$ 300,00
```

---

## 10. Regras de negócio

* **RN-EST-01** — Somente compras de cartão (à vista, parcelada ou ocorrência de recorrência com cartão) podem ser estornadas.
* **RN-EST-02** — Estorno não é lançamento, não tem categoria e não é `INCOME`.
* **RN-EST-03** — Estorno não altera nem exclui a compra original.
* **RN-EST-04** — Estorno pode ser total ou parcial; múltiplos estornos são permitidos.
* **RN-EST-05** — A soma dos estornos nunca ultrapassa o valor original; pedidos acima do saldo estornável são rejeitados.
* **RN-EST-06** — Em compra parcelada, o estorno é distribuído por `FIRST_INSTALLMENTS`, `LAST_INSTALLMENTS` ou `PROPORTIONAL`.
* **RN-EST-07** — Nenhuma alocação ultrapassa o saldo estornável da parcela; a soma das alocações é exatamente o valor estornado.
* **RN-EST-08** — A alocação é reconhecida na fatura do lançamento-alvo quando ela está `OPEN` e com mês aberto; caso contrário, na fatura do ciclo da `refund_date` ou, se esta também não puder receber crédito, na próxima fatura do cartão que possa.
* **RN-EST-08A** — Faturas `CLOSED` e `PAID` não recebem crédito de estorno.
* **RN-EST-09** — Estorno nunca reabre fatura `PAID` nem altera mês fechado.
* **RN-EST-10** — O crédito é liquidado; não tem status nem bloqueia fechamento.
* **RN-EST-11** — O crédito reduz o total da natureza da compra original no mês em que é reconhecido.
* **RN-EST-12** — Estornar ocorrência de recorrência não cancela a recorrência.
* **RN-EST-13** — `refund_date` fica entre a `purchase_date` e hoje.

---

## 11. Critérios de aceitação

* **CA-EST-01** — Compra de R$ 300, estorno total → impacto líquido R$ 0; compra preservada e identificada como totalmente estornada.
* **CA-EST-02** — Compra de R$ 300, estorno de R$ 100 → impacto líquido R$ 200.
* **CA-EST-03** — Compra de R$ 500 com R$ 300 já estornados: pedido de R$ 250 é rejeitado; pedido de R$ 200 é aceito.
* **CA-EST-04** — Tentativa de estornar lançamento pago com PIX é rejeitada.
* **CA-EST-05** — Tentativa de estornar ocorrência de recorrência paga com PIX é rejeitada.
* **CA-EST-06** — Estorno de ocorrência de recorrência de cartão não altera as ocorrências seguintes.
* **CA-EST-07** — `FIRST_INSTALLMENTS`, 4x R$ 100, estorno R$ 150 → 100 / 50 / 0 / 0.
* **CA-EST-08** — `LAST_INSTALLMENTS`, 4x R$ 100, estorno R$ 150 → 0 / 0 / 50 / 100.
* **CA-EST-09** — `PROPORTIONAL`, 3x R$ 100, estorno R$ 90 → 30 / 30 / 30.
* **CA-EST-10** — `PROPORTIONAL` sobre 33,33 / 33,33 / 33,34 usa os valores reais e soma exatamente o valor estornado.
* **CA-EST-11** — Compra em mês fechado, estorno tardio → crédito reconhecido na fatura do ciclo da `refund_date`; o mês fechado não muda.
* **CA-EST-12** — Crédito reduz as Saídas previstas do mês de reconhecimento e não altera o status de nenhum lançamento.
* **CA-EST-13** — O valor original da parcela permanece inalterado após o estorno.
* **CA-EST-14** — `refund_date` anterior à compra ou futura é rejeitada.
* **CA-EST-15** — Compra postada em fatura `CLOSED` não paga: o estorno é reconhecido na fatura do estorno, e a fatura `CLOSED` não recebe crédito.

---

## 12. Testes obrigatórios

* alvos permitidos e proibidos;
* limite total e por parcela; múltiplos estornos; rejeição acima do saldo;
* as três estratégias, inclusive com estornos anteriores e centavos;
* reconhecimento na fatura do alvo (`OPEN`), na fatura do estorno e na próxima fatura que possa receber crédito;
* rejeição de reconhecimento em fatura `CLOSED` ou `PAID`;
* criação de fatura para receber crédito;
* preservação da compra original e dos meses fechados;
* efeito nos totais do mês e da fatura; saldo credor;
* validação de `refund_date`.

---

## 13. Fora do escopo do MVP

Estorno de lançamentos que não sejam de cartão, confirmação automática de estorno pela operadora, estorno de pagamento de fatura e estorno de juros ou encargos.
