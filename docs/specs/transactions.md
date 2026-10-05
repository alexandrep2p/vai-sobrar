# Feature Spec — Lançamentos

## 1. Objetivo

Definir o lançamento (`Transaction`): a entrada ou saída financeira que compõe o planejamento mensal.

Esta spec é a **fonte normativa** para:

* campos e validações gerais do lançamento;
* natureza financeira pela categoria;
* status de pagamento e `paid_at`;
* criação futura e retroativa;
* alteração de vencimento (DEC-03);
* matriz de edição por origem;
* exclusão.

Regras específicas com fonte própria:

| Assunto | Fonte normativa |
|---|---|
| Compras de cartão: ciclo, fatura, compra tardia, janela de registro | `credit-cards.md` |
| Faturas e pagamento de fatura | `invoices.md` |
| Compras parceladas | `installments.md` |
| Estornos | `refunds.md` |
| Recorrências e ocorrências | `recurrences.md` |
| Mês financeiro e fechamento | `financial-periods.md` |
| Categorias | `categories.md` |
| Métodos de pagamento | `payment-methods.md` |

---

## 2. Origens

Todo lançamento tem uma origem:

| `origin` | Label | Descrição | Fonte |
|---|---|---|---|
| `MANUAL` | Manual | Criado diretamente pelo usuário com método comum | esta spec |
| `CREDIT_CARD` | Compra no cartão | Compra à vista no cartão | `credit-cards.md` |
| `INSTALLMENT` | Parcela | Parcela de compra parcelada | `installments.md` |
| `RECURRENCE` | Recorrência | Ocorrência gerada de uma recorrência (com método comum ou cartão) | `recurrences.md` |

Estornos não são lançamentos (`refunds.md`). Não existe origem `REFUND`.

A origem é exibida ao usuário e não substitui categoria, método ou status.

---

## 3. Estrutura

```text
Transaction
├── id
├── description
├── amount               (centavos, > 0)
├── financial_month      (YYYY-MM; financial-periods.md §3)
├── due_date
├── paid_at              (somente quando PAID)
├── status               (PENDING | PAID)
├── category_id
├── payment_method_id
├── origin               (MANUAL | CREDIT_CARD | INSTALLMENT | RECURRENCE)
├── purchase_date        (lançamentos de cartão)
├── invoice_id           (lançamentos de cartão)
├── recurrence_id        (origin = RECURRENCE)
├── occurrence_month     (origin = RECURRENCE; YYYY-MM)
├── created_at
└── updated_at
```

* A ligação com a parcela fica em `Installment.transaction_id` (1:1); o plano é alcançado pela parcela.
* Para lançamentos de cartão, `due_date` é o `due_date` da fatura e `financial_month` é o `reference_month` da fatura.
* `created_at` registra quando o lançamento foi cadastrado e nunca define mês, ciclo ou fatura.

---

## 4. Valor

* Obrigatório, maior que zero (mínimo R$ 0,01), em centavos inteiros.
* Sem limite de negócio; limite técnico do banco.
* Nunca negativo: a natureza vem da categoria, não do sinal.

---

## 5. Descrição

* Obrigatória; 1 a 200 caracteres após trim; não precisa ser única; aceita acentos e caracteres especiais.

---

## 6. Categoria e natureza financeira

* Todo lançamento tem exatamente uma categoria.
* A natureza (entrada ou saída) é **somente** o tipo da categoria: `INCOME` → entrada; `EXPENSE` → saída. Não existe campo de natureza no lançamento.
* Ao criar uma entrada, só categorias `INCOME` ativas são oferecidas; ao criar uma saída, só `EXPENSE` ativas.
* Categoria inativa não pode ser usada em novos lançamentos.
* Na edição, a nova categoria deve ter o mesmo tipo da atual e estar ativa.

---

## 7. Método de pagamento

* Todo lançamento tem exatamente um método de pagamento.
* Método inativo não pode ser usado em novos lançamentos. Um lançamento existente continua associado ao método mesmo que ele seja desativado depois, e a edição desse lançamento não obriga a trocar o método.
* O mesmo método serve para entradas e saídas.
* Se o método escolhido for um cartão de crédito, o lançamento é uma compra de cartão e segue `credit-cards.md`.
* O método de um lançamento com método comum só pode ser trocado por outro método comum. Trocar para cartão, ou de cartão para método comum, não é permitido, porque criaria ou desfaria uma compra de cartão.

---

## 8. Datas

| Campo | Significado |
|---|---|
| `due_date` | Data prevista da obrigação ou da receita. Em lançamentos com método comum, define o mês financeiro. Em lançamentos de cartão, é o vencimento da fatura e não define o mês financeiro. |
| `paid_at` | Data em que o lançamento foi efetivamente pago. Existe somente com `status = PAID`. |
| `purchase_date` | Data real da compra de cartão (`credit-cards.md` §7). |
| `created_at` | Data do cadastro. |

### 8.1 `paid_at`

* Obrigatório ao marcar como `PAID`; removido ao voltar para `PENDING`.
* Deve ser uma data válida, não posterior a hoje e não pertencente a um mês financeiro fechado.
* Pode ser anterior ao vencimento (pagamento antecipado) ou posterior (pagamento atrasado). Nunca muda o mês financeiro.

```text
Vencimento 15/09, pagamento 08/09 → setembro
Vencimento 02/10, pagamento 29/09 → outubro
```

---

## 9. Status

```text
PENDING → Em aberto
PAID    → Pago
```

* Lançamentos com método comum: com o mês financeiro aberto, o status pode mudar nos dois sentidos.
* Lançamentos de cartão (`CREDIT_CARD`, `INSTALLMENT` e ocorrências de recorrência com cartão): o status **não** é alterado individualmente. Eles ficam `PENDING` até o pagamento da fatura, que os torna `PAID` de forma definitiva (`invoices.md` §9.3).
* O status não altera o saldo previsto (`home.md`).
* Mês fechado: status imutável.

---

## 10. Criação

* **Futura:** permitida para qualquer data futura.
* **Retroativa:** permitida somente dentro do mês corrente, do dia 1 até hoje.

```text
Hoje 30/09
01/09, 15/09, 30/09 → permitido
31/08               → rejeitado
```

* Para compras de cartão, a janela se aplica à `purchase_date` (`credit-cards.md` §9).
* A criação é rejeitada se o mês financeiro resultante estiver fechado. Para cartão, aplica-se antes a regra de compra tardia (`credit-cards.md` §8.2).
* As janelas não se aplicam a lançamentos gerados pelo sistema (parcelas e ocorrências).

---

## 11. Alteração do vencimento (DEC-03, PD-14)

Aplica-se a lançamentos com método comum (`MANUAL` e ocorrências de recorrência com método comum).

* O `due_date` pode ser movido para uma data anterior ou posterior, desde que seja válida e que o mês de origem e o mês de destino estejam abertos.
* Se a nova data estiver em outro mês, o lançamento passa a pertencer ao novo mês financeiro.
* Mover para um mês fechado é rejeitado.

```text
Original 15/09 (setembro aberto)
10/09, 20/09        → permitido
05/10               → permitido se outubro estiver aberto
31/08               → permitido se agosto estiver aberto; rejeitado se fechado
```

Lançamentos de cartão não têm `due_date` editável: ele deriva da fatura.

---

## 12. Matriz de edição (com o mês financeiro aberto)

| Campo | `MANUAL` | `RECURRENCE` (método comum) | `RECURRENCE` (cartão) | `CREDIT_CARD` | `INSTALLMENT` |
|---|---|---|---|---|---|
| Descrição | sim | sim | sim ¹ | sim ¹ | sim, no plano inteiro ² |
| Valor | sim | sim | sim ¹ | não | sim, pelo plano inteiro ³ |
| `due_date` | sim (§11) | sim (§11) | não | não | não |
| `purchase_date` | — | — | não | não | sim, pelo plano inteiro ³ |
| Categoria | sim (mesmo tipo) | não (pertence à recorrência) | não | sim (mesmo tipo) ¹ | sim, no plano inteiro ² |
| Método | sim (só métodos comuns) | sim (só métodos comuns) | não | não | não |
| Status | sim | sim | não (somente via "Pagar fatura") | não (somente via "Pagar fatura") | não (somente via "Pagar fatura") |

¹ Somente enquanto a fatura de postagem não estiver `PAID` (PD-27).
² Somente quando todas as parcelas estiverem em meses abertos e nenhuma estiver em fatura `PAID` (`installments.md` §9).
³ Valor total, quantidade de parcelas e data da compra, regenerando as parcelas, somente sem parcela em fatura `PAID`, sem mês afetado fechado e sem estorno vinculado (`installments.md` §8, PD-36).

Em mês fechado, nada é editável (`financial-periods.md` §5).

---

## 13. Exclusão

| Origem | Regra |
|---|---|
| `MANUAL` | Exclusão física permitida com o mês aberto (DEC-09). |
| `RECURRENCE` | Pode ser apagada (PD-38): remove o lançamento e registra a exceção do mês, como em "pular" (`recurrences.md` §10). Ocorrência de cartão segue as travas de fatura. |
| `CREDIT_CARD` | Pode ser apagada (PD-38) enquanto a fatura não estiver `PAID`; os estornos dela são apagados junto. |
| `INSTALLMENT` | Parcela isolada não é apagada; apaga-se a compra parcelada inteira (`installments.md` §11). |

Em mês fechado, nenhuma exclusão é permitida. Em fatura `PAID`, nenhuma compra de cartão é apagada. Exclusão é provisória: no futuro será privilégio de super admin (PD-38).

---

## 14. Transferências

Transferências entre contas não fazem parte do MVP. Não existe tipo de lançamento de transferência e o sistema não simula uma transferência com uma entrada e uma saída.

---

## 15. Regras de negócio

* **RN-TRA-01** — Valor > 0, em centavos, nunca negativo.
* **RN-TRA-02** — Descrição obrigatória, 1 a 200 caracteres após trim.
* **RN-TRA-03** — Categoria obrigatória e ativa na criação.
* **RN-TRA-04** — Natureza = tipo da categoria; sem campo de natureza próprio.
* **RN-TRA-05** — Método obrigatório e ativo na criação.
* **RN-TRA-06** — Mês financeiro conforme `financial-periods.md` §3; para cartão, nunca `mês(due_date)`.
* **RN-TRA-07** — `paid_at` existe somente com `PAID`; não é futuro nem pertence a mês fechado; não altera o mês financeiro.
* **RN-TRA-08** — Status `PENDING`/`PAID`. Para método comum, reversível com o mês aberto; lançamentos de cartão são liquidados somente pela fatura e não voltam a `PENDING`.
* **RN-TRA-09** — O status não altera o saldo previsto.
* **RN-TRA-10** — Criação futura permitida; retroativa somente no mês corrente até hoje.
* **RN-TRA-11** — `due_date` de lançamento com método comum pode ir para frente ou para trás entre meses abertos.
* **RN-TRA-12** — Edição conforme a matriz da §12; categoria sempre do mesmo tipo.
* **RN-TRA-13** — Método comum só é trocado por outro método comum.
* **RN-TRA-14** — Exclusão física de lançamento (`MANUAL`, ocorrência de recorrência e compra à vista no cartão) com o mês aberto e, no cartão, fatura não `PAID` (PD-38).
* **RN-TRA-15** — Parcela de cartão não é apagada isoladamente: apaga-se a compra parcelada inteira; apagar uma compra de cartão apaga também os estornos dela (PD-38).
* **RN-TRA-16** — Mês fechado é imutável.
* **RN-TRA-17** — Estornos não são lançamentos.
* **RN-TRA-18** — Transferências estão fora do MVP.

---

## 16. Critérios de aceitação

* **CA-TRA-01** — Categoria `EXPENSE` e método válido → saída criada.
* **CA-TRA-02** — Categoria `INCOME` e método válido → entrada criada.
* **CA-TRA-03** — Entrada com categoria `EXPENSE` → rejeitada.
* **CA-TRA-04** — Sem método → rejeitada.
* **CA-TRA-05** — Valor R$ 0,00 ou negativo → rejeitado.
* **CA-TRA-06** — Vencimento 15/09, pagamento 08/09 → setembro.
* **CA-TRA-07** — Pagar lançamento com método comum → `PAID` com `paid_at`.
* **CA-TRA-08** — `PAID → PENDING` de lançamento com método comum, com mês aberto → aceito; `paid_at` removido.
* **CA-TRA-09** — Mudança de status não altera o saldo previsto.
* **CA-TRA-10** — Hoje 30/09: criar 15/09 → aceito; criar 31/08 → rejeitado.
* **CA-TRA-11** — Mover de 15/09 para 10/09 ou 20/09 com setembro aberto → aceito.
* **CA-TRA-12** — Mover para mês fechado → rejeitado.
* **CA-TRA-13** — Editar lançamento de mês fechado → rejeitado.
* **CA-TRA-14** — Excluir `MANUAL` em mês aberto → removido fisicamente.
* **CA-TRA-15** — Excluir compra à vista no cartão com fatura aberta → removida (e seus estornos); com fatura `PAID` ou mês fechado → rejeitado. Excluir parcela isolada → rejeitado.
* **CA-TRA-15A** — Apagar ocorrência de recorrência remove o lançamento e ela não é gerada de novo.
* **CA-TRA-16** — Alterar valor ou cartão de compra de cartão → rejeitado.
* **CA-TRA-17** — Trocar PIX por cartão em lançamento manual → rejeitado.
* **CA-TRA-18** — `paid_at` futuro → rejeitado.
* **CA-TRA-19** — Marcar como pago, individualmente, uma compra de cartão → rejeitado.
* **CA-TRA-20** — Editar descrição ou categoria de compra postada em fatura `PAID` → rejeitado.
* **CA-TRA-21** — Editar o valor de ocorrência de recorrência com cartão em fatura não paga → aceito.

---

## 17. Testes obrigatórios

* validações de valor, descrição, categoria e método;
* natureza pela categoria e rejeição de contradição;
* criação futura, retroativa no mês e rejeição de mês anterior;
* alteração de vencimento entre meses abertos e para mês fechado;
* status e `paid_at` (validações, reversão, rejeição de pagamento individual de cartão);
* matriz de edição por origem;
* exclusão por origem;
* mês financeiro de lançamento comum e de cartão.

---

## 18. Fora do escopo

Transferências, contas bancárias, Open Banking, conciliação, categorização automática, importação de transações e notificações.
