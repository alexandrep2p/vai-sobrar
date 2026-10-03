# Spec — Faturas

## 1. Objetivo

Definir o comportamento das faturas de cartão de crédito.

Esta spec é a **fonte normativa** para:

* persistência e identidade da fatura;
* máquina de estados `OPEN → CLOSED → PAID`;
* situação derivada de atraso;
* totais, valor a pagar e saldo credor (rollover);
* pagamento da fatura.

Regras referenciadas, com fonte própria:

| Assunto | Fonte normativa |
|---|---|
| Ciclo, `closing_date`, `reference_month`, `due_date`, fatura de postagem, compra tardia | `credit-cards.md` §5–§8 |
| Créditos de estorno e onde são reconhecidos | `refunds.md` |
| Parcelas | `installments.md` |
| Ocorrências de recorrência com cartão | `recurrences.md` |
| Fechamento do mês financeiro | `financial-periods.md` |

---

## 2. Conceito

Uma fatura (`Invoice`) agrupa os lançamentos de um cartão que pertencem a um mesmo ciclo e é o instrumento de liquidação desses lançamentos.

A fatura **não é uma despesa**. As compras, parcelas e ocorrências de cartão já representam o impacto financeiro. O pagamento da fatura apenas liquida esses lançamentos.

---

## 3. Identidade e campos

```text
Invoice
├── id
├── credit_card_id
├── reference_month          (mês do ciclo; mês financeiro dos lançamentos postados)
├── closing_date             (último dia do ciclo, gravado na criação)
├── due_date                 (vencimento, gravado na criação)
├── status                   (OPEN | CLOSED | PAID)
├── paid_at                  (data do pagamento; somente quando PAID)
├── payment_method_id        (método usado no pagamento; somente quando PAID)
├── credit_balance           (saldo credor apurado no pagamento; ver §8)
├── credit_transferred_to_invoice_id (fatura que recebeu o saldo credor; ver §8)
├── created_at
└── updated_at
```

* Unicidade: `(credit_card_id, reference_month)`.
* `closing_date` e `due_date` são calculados pela regra normativa de `credit-cards.md` §6 no momento da criação e **nunca** são recalculados.
* Cada cartão tem no máximo uma fatura por mês de referência; cartões diferentes têm faturas diferentes para o mesmo mês.

---

## 4. Persistência (DEC-04)

* Ciclos sem lançamentos **não** são persistidos.
* A fatura é criada fisicamente quando o primeiro lançamento é postado nela ou quando o primeiro crédito de estorno é reconhecido nela (`refunds.md`).
* A fatura é criada com `status = OPEN`. Se o `closing_date` já passou no momento da criação, ela passa a `CLOSED` na mesma operação.
* A interface pode projetar ciclos sem fatura persistida, calculando `closing_date` e `due_date` com a configuração vigente do cartão, e exibi-los como:

```text
Cartão Nubank — Fatura outubro/2028
Vencimento: 15/10/2028
Sem lançamentos
Total: R$ 0,00
```

---

## 5. Estados (normativo)

```text
OPEN ──(data atual > closing_date)──► CLOSED ──(ação "Pagar fatura")──► PAID
```

| Estado | Significado |
|---|---|
| `OPEN` (Aberta) | Ciclo de compras em andamento: data atual ≤ `closing_date`. |
| `CLOSED` (Fechada) | Ciclo encerrado e fatura ainda não paga. |
| `PAID` (Paga) | Fatura liquidada pela ação "Pagar fatura". Estado final. |

Regras:

* `OPEN → CLOSED` ocorre automaticamente quando a data atual ultrapassa o `closing_date`. Não existe fechamento manual.
* `CLOSED → PAID` ocorre **somente** pela ação "Pagar fatura" (§9).
* Uma fatura **não** passa a `PAID` porque o valor a pagar chegou a zero. Lançamentos de cartão não são pagos individualmente (§9.3).
* Não existe `PAID → CLOSED` nem `PAID → OPEN`. Uma fatura paga nunca é reaberta.
* Não existe pagamento de fatura `OPEN`.

### 5.1 O que cada estado aceita

| Operação | `OPEN` | `CLOSED` | `PAID` |
|---|---|---|---|
| Receber compra do próprio ciclo (inclusive retroativa, DEC-06) | sim | sim | não → compra tardia (`credit-cards.md` §8.2) |
| Receber compra tardia de ciclo anterior | sim | sim | não |
| Receber crédito de estorno | sim | não → fatura do estorno (`refunds.md` §8) | não |
| Editar descrição, categoria ou valor de lançamento postado (quando a matriz de `transactions.md` §12 permitir) | sim | sim | não |
| Pagar | não | sim | não |

A fatura `CLOSED` continua aceitando compras do próprio ciclo e compras tardias (DEC-06), mas **não** recebe créditos de estorno (PD-23).

Nenhuma operação modifica uma fatura `PAID`, inclusive descrição, categoria, valor ou status dos seus lançamentos, nem uma fatura cujo `reference_month` seja um mês financeiro `CLOSED`.

---

## 6. Atraso (situação derivada)

Uma fatura `CLOSED` cujo `due_date` já passou é apresentada como **atrasada** (`OVERDUE`). Não é um estado persistido.

```text
Status: CLOSED
Situação: Atrasada
```

* A situação de atraso independe do valor a pagar: uma fatura `CLOSED` com R$ 0,00 a pagar e vencimento passado também é apresentada como atrasada até ser paga (PD-31).
* A fatura atrasada continua sendo a fatura do seu `reference_month`; não é transferida para a fatura seguinte.
* O MVP não aplica juros, multa, encargos nem atualização de valor.
* A fatura atrasada pode ser paga normalmente e passa a `PAID`.

---

## 7. Totais

Valores em centavos, calculados a partir do que está vinculado à fatura:

```text
débitos          = Σ amount dos lançamentos postados na fatura
créditos         = Σ amount das alocações de estorno reconhecidas na fatura   (refunds.md)
crédito_recebido = Σ credit_balance das faturas PAID transferidas para esta   (§8)

valor_a_pagar = max(0, débitos − créditos − crédito_recebido)
saldo_credor  = max(0, créditos + crédito_recebido − débitos)
```

Exemplo:

```text
Compra            R$ 500,00
Estorno          −R$ 200,00
Valor a pagar     R$ 300,00
```

---

## 8. Saldo credor e rollover (normativo, PD-05)

Quando créditos (estornos e crédito recebido) superam os débitos, a fatura fica com valor a pagar R$ 0,00 e com saldo credor.

* O saldo credor é **um atributo da fatura**, não um lançamento. Ele não aparece no extrato e não altera o saldo previsto de nenhum mês. O impacto financeiro do estorno já foi reconhecido no mês da fatura em que o crédito entrou (`refunds.md`).
* O saldo credor é apurado e gravado em `credit_balance` quando a fatura passa a `PAID`.
* O saldo credor é transferido para a **próxima fatura do mesmo cartão que não esteja `PAID`**, seja `OPEN` ou `CLOSED` (`credit_transferred_to_invoice_id`). A transferência apenas reduz o valor a pagar da fatura de destino; não é crédito de estorno, e a restrição da PD-23 não se aplica (PD-30). Se essa fatura ainda não existir, a transferência fica pendente até a criação de uma fatura de ciclo posterior.
* Na fatura de destino, o valor transferido entra como `crédito_recebido` e é consumido antes do cálculo do valor a pagar.
* Se o crédito recebido também superar os débitos da fatura de destino, o restante segue a mesma regra quando ela for paga.

Exemplo:

```text
Fatura outubro
Débitos         R$ 100,00
Créditos        R$ 150,00
Valor a pagar   R$   0,00
Pagar fatura (R$ 0,00) → PAID, credit_balance = R$ 50,00

Fatura novembro
Débitos           R$ 300,00
Crédito recebido  R$  50,00
Valor a pagar     R$ 250,00
```

Nenhuma transação `REFUND` é criada para representar o rollover.

---

## 9. Pagamento da fatura (normativo, PD-07)

Ação explícita: **Pagar fatura**.

### 9.1 Pré-condições

* `status = CLOSED`;
* o mês financeiro do `reference_month` está aberto;
* `paid_at` informado: data válida, não posterior a hoje e não pertencente a um mês financeiro fechado;
* `payment_method_id` informado: método ativo e diferente do método do próprio cartão da fatura.

Qualquer outro método ativo é aceito, inclusive PIX, Dinheiro, Débito e métodos criados pelo usuário.

### 9.2 Efeitos (atômicos)

1. todos os lançamentos da fatura (todos `PENDING`, ver §9.3) passam a `PAID` com `paid_at` igual à data do pagamento;
2. a fatura passa a `PAID` e registra `paid_at` e `payment_method_id`;
3. o saldo credor é apurado e transferido (§8).

O pagamento:

* não cria lançamento de despesa nem de entrada;
* não altera o mês financeiro de nenhum lançamento;
* é a única forma de levar a fatura a `PAID`, inclusive quando o valor a pagar é R$ 0,00.

Não existe pagamento parcial. Não existe desfazer pagamento.

Exemplo:

```text
Fatura outubro (CLOSED)
A — em aberto
B — em aberto
C — em aberto

Pagar fatura em 12/10 via PIX

A, B, C → pagos em 12/10
Fatura → PAID, paid_at 12/10, método PIX
```

### 9.3 Liquidação de lançamentos de cartão (PD-24)

Lançamentos de cartão (compras à vista, parcelas e ocorrências de recorrência com cartão) são liquidados **somente** pela ação "Pagar fatura".

* Não podem ser marcados como pagos individualmente.
* Permanecem `PENDING` até o pagamento da sua fatura.
* Depois do pagamento ficam `PAID` e não voltam para `PENDING` (não existe desfazer pagamento).

Consequência: um mês só fecha depois que todas as faturas com aquele `reference_month` estiverem pagas, inclusive as que só têm créditos (`financial-periods.md` §4.1, PD-29).

---

## 10. Fatura e mês financeiro

* O mês financeiro de todos os lançamentos postados na fatura é o seu `reference_month` (DEC-01).
* O `due_date` pode cair no mês seguinte ao `reference_month`; isso não muda o mês financeiro.
* O pagamento pode ocorrer em qualquer data permitida (§9.1) sem alterar o `reference_month`.
* O fechamento de um mês financeiro não fecha, paga ou altera faturas.
* O mês só fecha com todas as faturas do seu `reference_month` `PAID`, inclusive as que só têm créditos de estorno (`financial-periods.md` §4.1).

---

## 11. Cartão desativado

* Faturas existentes continuam disponíveis e podem ser pagas normalmente.
* Parcelas futuras já programadas continuam em suas faturas, que continuam sendo exibidas.
* Depois da última fatura com lançamentos, o cartão desativado deixa de aparecer na visão de faturas futuras.
* O histórico nunca é apagado.

---

## 12. Integridade histórica

Faturas persistidas preservam cartão, `reference_month`, `closing_date`, `due_date`, lançamentos postados, créditos reconhecidos e dados de pagamento. Alterações na configuração do cartão nunca reescrevem faturas persistidas (`credit-cards.md` §12).

---

## 13. Regras de negócio

* **RN-FAT-01** — Todo lançamento de cartão está postado em exatamente uma fatura.
* **RN-FAT-02** — A fatura pertence a exatamente um cartão; `(credit_card_id, reference_month)` é único.
* **RN-FAT-03** — `closing_date` e `due_date` são gravados na criação e nunca recalculados.
* **RN-FAT-04** — Ciclos sem lançamentos e sem créditos não são persistidos; podem ser projetados na interface com total R$ 0,00.
* **RN-FAT-05** — A fatura nasce `OPEN`; se o `closing_date` já passou, passa a `CLOSED` na mesma operação.
* **RN-FAT-06** — `OPEN → CLOSED` é automático após o `closing_date`; não há fechamento manual.
* **RN-FAT-07** — `CLOSED → PAID` ocorre somente pela ação "Pagar fatura".
* **RN-FAT-08** — Valor a pagar zero não torna a fatura `PAID`.
* **RN-FAT-08A** — Lançamentos de cartão são liquidados somente pela ação "Pagar fatura"; não há pagamento individual (PD-24).
* **RN-FAT-08B** — Fatura `CLOSED` aceita compras do ciclo e compras tardias, mas não recebe créditos de estorno (PD-23).
* **RN-FAT-09** — `PAID` é estado final; fatura paga nunca é reaberta nem modificada, inclusive descrição, categoria, valor e status dos seus lançamentos.
* **RN-FAT-10** — Só faturas `CLOSED` podem ser pagas.
* **RN-FAT-11** — O pagamento exige data (não futura e fora de mês fechado) e método ativo diferente do próprio cartão.
* **RN-FAT-12** — O pagamento liquida atomicamente todos os lançamentos da fatura com a data do pagamento.
* **RN-FAT-13** — O pagamento não cria lançamento financeiro.
* **RN-FAT-14** — Não existe pagamento parcial nem desfazer pagamento.
* **RN-FAT-15** — Atraso é situação derivada (`CLOSED` e `due_date` passado, independentemente do valor a pagar), sem juros nem multa.
* **RN-FAT-16** — Fatura atrasada continua no seu `reference_month`.
* **RN-FAT-17** — Saldo credor é atributo da fatura, apurado no pagamento e transferido para a próxima fatura não paga (`OPEN` ou `CLOSED`) do mesmo cartão; não gera lançamento.
* **RN-FAT-17A** — Um mês só fecha com todas as suas faturas `PAID`, inclusive faturas só com créditos.
* **RN-FAT-18** — Nenhuma operação modifica fatura cujo `reference_month` seja mês financeiro fechado.
* **RN-FAT-19** — Faturas de cartão desativado continuam exibidas e pagáveis enquanto houver lançamentos.
* **RN-FAT-20** — Não existe limite de crédito no MVP.

---

## 14. Critérios de aceitação

* **CA-FAT-01** — Primeira compra de um ciclo cria a fatura `OPEN` com `closing_date` e `due_date` calculados.
* **CA-FAT-02** — Fatura criada para ciclo já encerrado é gravada como `CLOSED`.
* **CA-FAT-03** — Após o `closing_date`, a fatura passa automaticamente a `CLOSED`.
* **CA-FAT-04** — Tentativa de pagar fatura `OPEN` é rejeitada.
* **CA-FAT-05** — Pagar fatura `CLOSED` com A, B e C em aberto em 12/10 → A, B e C pagos em 12/10; fatura `PAID`.
* **CA-FAT-06** — Tentativa de marcar como pago, individualmente, um lançamento de cartão é rejeitada.
* **CA-FAT-07** — Pagamento com o próprio cartão da fatura é rejeitado.
* **CA-FAT-08** — Pagamento com método inativo é rejeitado.
* **CA-FAT-09** — Pagamento com data futura é rejeitado.
* **CA-FAT-10** — Fatura com débitos R$ 100 e créditos R$ 150: valor a pagar R$ 0; após "Pagar fatura", `credit_balance` R$ 50 transferido para a fatura seguinte, que tem seu valor a pagar reduzido em R$ 50.
* **CA-FAT-11** — O rollover não cria lançamento e não altera o saldo previsto de nenhum mês.
* **CA-FAT-12** — Fatura com valor a pagar zero continua `CLOSED` até a ação "Pagar fatura".
* **CA-FAT-13** — Fatura `CLOSED` com vencimento 15/09 e hoje 20/09 é exibida como atrasada; continua sendo a fatura de setembro.
* **CA-FAT-14** — Tentativa de alterar ou reabrir fatura `PAID` é rejeitada.
* **CA-FAT-15** — Alteração de `due_day` do cartão não altera o `due_date` de faturas persistidas.
* **CA-FAT-16** — Ciclo futuro sem lançamentos é exibido como "Sem lançamentos", total R$ 0,00, sem fatura persistida.
* **CA-FAT-17** — Cartão desativado com parcelas até julho: faturas de abril a julho continuam exibidas e pagáveis.
* **CA-FAT-18** — Estorno com alvo em fatura `CLOSED` não paga é reconhecido na fatura do estorno, não na fatura `CLOSED`.
* **CA-FAT-20** — Fatura `CLOSED` com R$ 0,00 a pagar e vencimento passado é exibida como atrasada até ser paga.
* **CA-FAT-21** — Saldo credor de outubro é transferido para a fatura de novembro mesmo que ela já esteja `CLOSED`, reduzindo o seu valor a pagar.
* **CA-FAT-19** — Editar descrição ou categoria de lançamento postado em fatura `PAID` é rejeitado.

---

## 15. Testes obrigatórios

* criação na primeira postagem e no primeiro crédito; criação já `CLOSED`;
* transição automática `OPEN → CLOSED`;
* rejeição de pagamento em `OPEN` e em `PAID`;
* pagamento: atomicidade, data e método válidos, rejeição do próprio cartão;
* rejeição de pagamento individual de lançamento de cartão;
* rejeição de crédito de estorno em fatura `CLOSED`;
* ausência de lançamento financeiro no pagamento;
* totais com créditos; valor a pagar zero; saldo credor; transferência para fatura existente e pendente de criação; cascata;
* situação de atraso derivada;
* imutabilidade de fatura `PAID` e de fatura de mês fechado;
* preservação de `closing_date`/`due_date` após alteração do cartão;
* projeção de ciclo vazio sem persistência.

---

## 16. Fora do escopo do MVP

Pagamento parcial, desfazer pagamento, juros, multas, encargos, renegociação, parcelamento de fatura, rotativo, pagamento mínimo, limite de crédito, integração com operadoras, conciliação bancária e fechamento manual de fatura.
