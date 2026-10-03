# Spec — Períodos Financeiros (Mês)

## 1. Objetivo

Definir o mês financeiro, seu fechamento e a barreira de imutabilidade que o fechamento cria.

Esta spec é a **fonte normativa** para:

* existência lógica dos meses;
* atribuição do mês financeiro de cada item do planejamento;
* pré-condições, ordem e efeitos do fechamento;
* imutabilidade de mês fechado.

---

## 2. Conceito

Cada mês do calendário (`YYYY-MM`) é um período financeiro do planejamento.

* Um mês existe **logicamente** sem precisar de registro persistido.
* Todo mês está `OPEN` (Aberto) até ser fechado explicitamente.
* O registro `FinancialPeriod` é persistido quando necessário (no mínimo, no fechamento).

```text
FinancialPeriod
├── id
├── reference_month   (YYYY-MM, único)
├── status            (OPEN | CLOSED)
├── closed_at
├── created_at
└── updated_at
```

---

## 3. Mês financeiro de cada item (normativo)

| Item | Mês financeiro |
|---|---|
| Lançamento com método comum (manual ou ocorrência de recorrência) | mês do `due_date` |
| Lançamento de cartão (compra à vista, parcela, ocorrência de recorrência com cartão) | `reference_month` da fatura de postagem (`credit-cards.md` §8) |
| Ocorrência de recorrência projetada | conforme as duas linhas acima, usando a data e a fatura projetadas |
| Alocação de estorno | `reference_month` da fatura em que foi reconhecida (`refunds.md` §8) |

A data de pagamento (`paid_at`) nunca altera o mês financeiro. Para lançamentos de cartão, o mês financeiro nunca é `mês(due_date)`.

---

## 4. Fechamento

O fechamento é uma ação **manual e explícita** do usuário ("Fechar mês"), com confirmação, e é **irreversível**.

O sistema nunca fecha um mês automaticamente, nem quando todos os lançamentos são pagos.

### 4.1 Pré-condições

Um mês só pode ser fechado quando:

1. está `OPEN`;
2. não é um mês futuro: só podem ser fechados meses passados e o mês corrente;
3. todos os seus lançamentos estão `PAID` (os lançamentos de cartão só ficam `PAID` com o pagamento da fatura, `invoices.md` §9.3);
4. não há ocorrência de recorrência projetada nele (cada uma deve ser paga ou pulada antes);
5. todas as faturas com `reference_month` igual ao mês estão `PAID`, inclusive faturas que só tenham créditos de estorno (pagas com "Pagar fatura" de R$ 0,00) (PD-29);
6. todo mês anterior que **possua lançamentos** está fechado (fechamento cronológico). Meses anteriores sem nenhum lançamento não bloqueiam o fechamento.

Alocações de estorno não são lançamentos: não têm status, não bloqueiam o fechamento e não tornam um mês "com lançamentos" para efeito do item 6. A fatura que as contém, porém, precisa estar `PAID` (item 5).

O **mês corrente** pode ser fechado antes do seu último dia, se as pré-condições forem atendidas (PD-26). Depois disso, os dias restantes do mês ficam sob a barreira de imutabilidade (§5): novos lançamentos com data nesse mês são rejeitados, e compras de cartão cujo ciclo pertença a esse mês seguem a regra de compra tardia.

Se alguma pré-condição falhar, o fechamento é rejeitado e o usuário é informado do motivo (por exemplo, lançamentos em aberto ou mês anterior aberto).

### 4.2 Efeitos

* `status = CLOSED` e `closed_at` registrado, em transação de banco.
* Não existe ação de reabertura.

### 4.3 Consequências do fechamento cronológico

* Os lançamentos de cartão de um mês ficam no mês do `reference_month` e só são liquidados pelo pagamento da fatura. Por isso, uma fatura não paga impede o fechamento do seu mês e, por consequência, dos meses seguintes.
* Exemplo: melhor dia 25, vencimento 5. Outubro só pode ser fechado depois que a fatura de outubro, que vence em 05/11, for paga. Isso exige que ela esteja `CLOSED`, ou seja, depois de 25/10.

---

## 5. Imutabilidade de mês fechado (normativo)

O fechamento é uma barreira de imutabilidade. Em um mês `CLOSED`:

* nenhum lançamento pode ser criado, editado, excluído ou ter status, data, valor, descrição, categoria, método, recorrência ou parcelamento alterados;
* nenhum lançamento pode ser movido para o mês ou para fora dele;
* nenhuma fatura cujo `reference_month` seja esse mês pode receber lançamentos ou créditos, ser paga ou ser alterada;
* nenhuma alocação de estorno é reconhecida nele;
* nenhuma ocorrência de recorrência é gerada, projetada ou pulada nele.

Os dados continuam disponíveis para consulta, exatamente como estavam no fechamento.

Eventos posteriores relacionados ao mês fechado são registrados em meses abertos, pelas regras próprias:

| Evento | Regra |
|---|---|
| Compra cujo ciclo pertence a mês fechado | compra tardia (`credit-cards.md` §8.2) |
| Estorno de compra de mês fechado | reconhecido na fatura do estorno (`refunds.md` §8) |
| Parcelas futuras de compra feita antes do fechamento | permanecem em seus meses (`installments.md`) |

Recorrências e parcelamentos não são bloqueados pelo fechamento de um mês; o que importa é o mês financeiro efetivamente afetado.

---

## 6. Independência entre mês e fatura

* Fechar um mês não fecha, paga nem altera faturas.
* Fechar um mês não depende de faturas de outros meses. Exemplo, com melhor dia 6: uma compra de 25/09 está na fatura de outubro; setembro pode ser fechado sem que essa fatura esteja paga.

---

## 7. Regras de negócio

* **RN-PER-01** — Meses existem logicamente e estão abertos até o fechamento explícito.
* **RN-PER-02** — O mês financeiro de cada item segue a tabela da §3.
* **RN-PER-03** — `paid_at` nunca altera o mês financeiro.
* **RN-PER-04** — Fechamento é manual, explícito, confirmado e irreversível.
* **RN-PER-05** — Fechamento exige todos os lançamentos `PAID`, nenhuma ocorrência projetada no mês e todas as faturas do mês `PAID`.
* **RN-PER-06** — Fechamento é cronológico: todo mês anterior que possua lançamentos precisa estar fechado.
* **RN-PER-06A** — Meses futuros não podem ser fechados; o mês corrente pode ser fechado antes do seu último dia.
* **RN-PER-07** — Mês fechado é imutável, inclusive faturas com aquele `reference_month`.
* **RN-PER-08** — Eventos posteriores são registrados em meses abertos, sem reabrir o histórico.
* **RN-PER-09** — Fechar um mês não altera faturas.

---

## 8. Critérios de aceitação

* **CA-PER-01** — Mês com todos os lançamentos pagos continua `OPEN` até o usuário fechar.
* **CA-PER-02** — Fechamento exige confirmação e registra `closed_at`.
* **CA-PER-03** — Mês com lançamento `PENDING` não fecha.
* **CA-PER-04** — Mês com ocorrência projetada não fecha.
* **CA-PER-04A** — Mês com fatura não paga (inclusive fatura só com créditos de estorno) não fecha.
* **CA-PER-05** — Mês com um mês anterior aberto que possua lançamentos não fecha.
* **CA-PER-05A** — Mês anterior aberto sem nenhum lançamento não bloqueia o fechamento.
* **CA-PER-05B** — Tentativa de fechar mês futuro é rejeitada.
* **CA-PER-05C** — Mês corrente com tudo pago pode ser fechado antes do último dia; depois disso, criar lançamento com data nesse mês é rejeitado.
* **CA-PER-06** — Não existe operação de reabertura.
* **CA-PER-07** — Em mês fechado: criar, editar, excluir, mudar status, mover data para dentro ou para fora são rejeitados.
* **CA-PER-08** — Fatura com `reference_month` em mês fechado não recebe compra nem crédito e não pode ser paga.
* **CA-PER-09** — Estorno tardio de compra de mês fechado é reconhecido em fatura de mês aberto; o mês fechado não muda.
* **CA-PER-10** — Setembro fecha com compra de 25/09 na fatura de outubro ainda não paga.

---

## 9. Testes obrigatórios

* abertura lógica sem registro persistido;
* fechamento: confirmação, pendências, projeções, faturas do mês não pagas (inclusive só com créditos), ordem cronológica (com e sem lançamentos nos meses anteriores), mês futuro, mês corrente antecipado;
* irreversibilidade;
* barreira de imutabilidade para todas as operações (lançamentos, faturas, estornos, recorrências);
* atribuição do mês financeiro (comum, cartão com vencimento no mês seguinte, projeção, alocação de estorno).
