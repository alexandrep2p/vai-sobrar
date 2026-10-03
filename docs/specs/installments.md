# Spec — Compras Parceladas

## 1. Objetivo

Definir as compras parceladas no cartão de crédito.

Esta spec é a **fonte normativa** para:

* criação do plano de parcelamento;
* distribuição determinística de centavos (usada também por `refunds.md`);
* associação das parcelas às faturas;
* imutabilidade e edição da compra parcelada.

Regras referenciadas:

| Assunto | Fonte normativa |
|---|---|
| Ciclo, fatura de postagem, compra tardia | `credit-cards.md` §6–§8 |
| Pagamento e estados da fatura | `invoices.md` |
| Estorno de compra parcelada | `refunds.md` |
| Fechamento do mês | `financial-periods.md` |

---

## 2. Conceito

Uma compra parcelada é **uma única compra** no cartão com valor total dividido em **2 ou mais** parcelas.

```text
InstallmentPlan (metadados da compra; sem impacto financeiro próprio)
├── Installment 1/N ── 1:1 ── Transaction (origin = INSTALLMENT) ── Invoice do ciclo 1
├── Installment 2/N ── 1:1 ── Transaction (origin = INSTALLMENT) ── Invoice do ciclo 2
└── Installment N/N ── 1:1 ── Transaction (origin = INSTALLMENT) ── Invoice do ciclo N
```

* Não existe "transação-mãe" com o valor total (DEC-02). O impacto financeiro vem exclusivamente das transações das parcelas.
* Cada parcela é um lançamento financeiro individual, com status próprio, no mês financeiro da sua fatura.
* Compra em `1x` é compra à vista (`credit-cards.md`).

---

## 3. Estrutura

```text
InstallmentPlan
├── id
├── credit_card_id
├── total_amount          (centavos)
├── installment_count     (>= 2)
├── purchase_date
├── created_at
└── updated_at

Installment
├── id
├── installment_plan_id
├── transaction_id        (1:1, único)
├── number                (1..installment_count)
└── created_at
```

* Valor, descrição, categoria, fatura, vencimento, status e `paid_at` de cada parcela estão na `Transaction` correspondente. `Installment` não os duplica.
* Todas as transações de um plano compartilham a mesma descrição, a mesma categoria, o mesmo cartão (método de pagamento) e a mesma `purchase_date` do plano.

---

## 4. Criação

O usuário informa uma única vez:

```text
Descrição
Valor total
Data da compra
Cartão
Quantidade de parcelas (>= 2)
Categoria
```

O sistema calcula o valor, o número, a fatura e o vencimento de cada parcela. O usuário não informa valores individuais.

A criação é atômica: plano, parcelas, transações e faturas necessárias são criados na mesma transação de banco, ou nada é criado.

A `purchase_date` segue a janela de registro de compras de cartão (`credit-cards.md` §9). O cartão deve estar ativo; a categoria deve estar ativa.

### 4.1 Quantidade de parcelas

* Mínimo de negócio: **2**.
* Não há máximo de negócio. O backend aplica um limite **técnico** de 120 parcelas para proteger a aplicação; esse limite não é regra de negócio e pode ser revisto.

---

## 5. Valor total

O valor total informado é a fonte de verdade:

```text
Σ valores das parcelas = valor total
```

Não pode existir diferença de centavos.

---

## 6. Distribuição de centavos (normativo)

Valores são tratados em centavos inteiros.

```text
base  = piso(total / n)
resto = total − base × n

as primeiras (n − resto) parcelas recebem base
as últimas resto parcelas recebem base + 1 centavo
```

Exemplos:

```text
R$ 100,00 / 3  → 33,33 · 33,33 · 33,34
R$ 10,00 / 6   → 1,66 · 1,66 · 1,67 · 1,67 · 1,67 · 1,67
R$ 300,00 / 3  → 100,00 · 100,00 · 100,00
```

A mesma regra (piso para todos e centavos restantes nas últimas posições) é usada na distribuição proporcional de estornos (`refunds.md` §7.3).

---

## 7. Parcelas e faturas

* A **parcela 1** é postada na fatura determinada pela `purchase_date` (`credit-cards.md` §8), inclusive pela regra de compra tardia.
* A **parcela k** (k ≥ 2) é postada na fatura do ciclo imediatamente seguinte ao da parcela k−1.
* Faturas ainda não persistidas são criadas (`invoices.md` §4).
* O `due_date` de cada parcela é o `due_date` da sua fatura; parcelas não têm vencimento próprio.
* O mês financeiro de cada parcela é o `reference_month` da sua fatura.

Exemplo — melhor dia 6, vencimento 15:

```text
Compra em 05/10, 3x
1/3 → fatura outubro  (vence 15/10) → mês financeiro outubro
2/3 → fatura novembro (vence 15/11) → mês financeiro novembro
3/3 → fatura dezembro (vence 15/12) → mês financeiro dezembro
```

Exemplo — compra depois do melhor dia:

```text
Compra em 07/10, 3x
1/3 → novembro · 2/3 → dezembro · 3/3 → janeiro
```

Exemplo — melhor dia 25, vencimento 5:

```text
Compra em 20/10, 2x
1/2 → fatura outubro  (vence 05/11) → mês financeiro outubro
2/2 → fatura novembro (vence 05/12) → mês financeiro novembro
```

Alterações posteriores na configuração do cartão não movem parcelas nem alteram suas faturas (`credit-cards.md` §12).

---

## 8. Imutabilidade

Depois da criação são imutáveis:

* valor total;
* quantidade de parcelas;
* cartão;
* `purchase_date`;
* valores originais das parcelas;
* numeração;
* faturas das parcelas;
* estrutura do plano.

Não é permitido editar isoladamente o valor ou a estrutura de uma parcela.

---

## 9. Edição de descrição e categoria (PD-12, PD-27)

Descrição e categoria são da compra inteira: a alteração é aplicada a todas as parcelas ao mesmo tempo.

A alteração só é permitida quando **todas** as parcelas:

* estão em meses financeiros abertos; e
* estão postadas em faturas que não estão `PAID`.

Se alguma parcela estiver em mês fechado ou em fatura `PAID`, a alteração é **rejeitada**. Não existe alteração parcial que atinja só algumas parcelas.

A nova categoria deve ser ativa e ter o mesmo tipo (`INCOME`/`EXPENSE`) da atual.

Nenhuma edição de descrição ou categoria recria, remove ou move parcelas.

---

## 10. Pagamento das parcelas

* Cada parcela tem status próprio (`PENDING`/`PAID`).
* Parcelas são liquidadas **somente** pelo pagamento da fatura em que estão postadas (`invoices.md` §9.3); não há pagamento individual.
* Pagar uma fatura liquida somente as parcelas postadas naquela fatura.

---

## 11. Exclusão e estorno

* Compra parcelada, plano e parcelas não são excluídos.
* Para desfazer financeiramente, total ou parcialmente, usa-se o estorno do plano (`refunds.md`). O estorno não cancela o plano nem altera os valores originais das parcelas.

---

## 12. Cartão desativado

* A desativação não cancela parcelas já existentes; elas continuam válidas em suas faturas.
* Depois da última parcela, nenhuma nova fatura surge por causa da compra.
* A reativação não cria parcelas.

---

## 13. Fechamento do mês

* Fechar um mês não depende do término do plano.
* Parcelas de meses fechados tornam-se imutáveis; parcelas de meses abertos seguem as regras do seu mês.

---

## 14. Regras de negócio

* **RN-PAR-01** — Compra parcelada tem de 2 parcelas em diante; `1x` é compra à vista.
* **RN-PAR-02** — O usuário informa o valor total; o sistema calcula as parcelas.
* **RN-PAR-03** — A soma das parcelas é exatamente o valor total.
* **RN-PAR-04** — Centavos restantes vão para as últimas parcelas (§6).
* **RN-PAR-05** — Cada parcela é uma `Transaction` (`origin = INSTALLMENT`) ligada 1:1 a um `Installment`; não há transação-mãe.
* **RN-PAR-06** — A parcela 1 segue a fatura da `purchase_date`; cada parcela seguinte vai para o ciclo seguinte.
* **RN-PAR-07** — Vencimento e mês financeiro da parcela vêm da sua fatura.
* **RN-PAR-08** — Valor total, quantidade, cartão, `purchase_date`, valores, numeração e faturas são imutáveis.
* **RN-PAR-09** — Descrição e categoria só mudam se todas as parcelas estiverem em meses abertos e nenhuma estiver em fatura `PAID`; a mudança vale para todas as parcelas.
* **RN-PAR-10** — Não há edição isolada de valor ou estrutura de uma parcela.
* **RN-PAR-11** — Parcelas são liquidadas somente pelo pagamento da sua fatura.
* **RN-PAR-12** — Plano e parcelas não são excluídos; usa-se estorno.
* **RN-PAR-13** — Desativação do cartão não cancela parcelas; reativação não cria parcelas.
* **RN-PAR-14** — Limite técnico de 120 parcelas (restrição técnica, não de negócio).

---

## 15. Critérios de aceitação

* **CA-PAR-01** — R$ 300 em 3x → 100 / 100 / 100.
* **CA-PAR-02** — R$ 100 em 3x → 33,33 / 33,33 / 33,34.
* **CA-PAR-03** — R$ 10 em 6x → 1,66 / 1,66 / 1,67 / 1,67 / 1,67 / 1,67.
* **CA-PAR-04** — Melhor dia 6, compra 05/10, 3x → outubro, novembro, dezembro.
* **CA-PAR-05** — Melhor dia 6, compra 07/10, 3x → novembro, dezembro, janeiro.
* **CA-PAR-06** — Vencimento de cada parcela = vencimento da sua fatura.
* **CA-PAR-07** — Pedido de 1 parcela pelo fluxo de parcelamento é rejeitado (é compra à vista).
* **CA-PAR-08** — Alterar cartão, quantidade, valor total ou data da compra é rejeitado.
* **CA-PAR-09** — Alterar descrição ou categoria com todas as parcelas em meses abertos e faturas não pagas altera todas; com uma parcela em mês fechado ou em fatura `PAID`, é rejeitado.
* **CA-PAR-10** — Pagar a fatura de outubro paga somente 1/3.
* **CA-PAR-11** — Cartão desativado em março com parcelas até julho: parcelas e faturas de abril a julho continuam existindo.
* **CA-PAR-12** — Não existe transação com o valor total no extrato.

---

## 16. Testes obrigatórios

* distribuição de centavos (divisão exata e com resto);
* mínimo de 2 parcelas e limite técnico;
* associação às faturas (antes e depois do melhor dia; vencimento no mês seguinte; compra tardia na primeira parcela);
* atomicidade da criação;
* imutabilidades;
* edição de descrição e categoria com todas as parcelas abertas, com parcela em mês fechado e com parcela em fatura paga;
* rejeição de pagamento individual de parcela;
* pagamento por fatura;
* desativação do cartão;
* ausência de transação-mãe.

---

## 17. Fora do escopo do MVP

Alterar quantidade, valor total ou cartão após a compra; renegociação; antecipação de parcelas; desconto por antecipação; juros calculados pelo sistema; rotativo; limite de crédito; pagamento parcial de fatura.
