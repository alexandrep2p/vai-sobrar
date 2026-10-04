# Spec — Cartões de Crédito

## 1. Objetivo

Definir o cadastro e a configuração dos cartões de crédito e a **regra normativa do ciclo do cartão**: como se determinam o fechamento, o mês de referência e o vencimento de uma fatura, e a qual fatura pertence cada lançamento de cartão.

Esta spec é a **fonte normativa** para:

* ajuste de dias inexistentes no mês (§5);
* ciclo, fechamento, mês de referência e vencimento da fatura (§6);
* datas de um lançamento de cartão (§7);
* determinação da fatura de um lançamento de cartão, incluindo compras retroativas e compras tardias (§8);
* janela de registro de compras de cartão (§9).

Os demais assuntos têm fonte própria e são apenas referenciados aqui:

| Assunto | Fonte normativa |
|---|---|
| Estados, totais, saldo credor e pagamento da fatura | `invoices.md` |
| Compra parcelada e distribuição de centavos | `installments.md` |
| Estornos | `refunds.md` |
| Recorrências (inclusive com cartão) | `recurrences.md` |
| Fechamento do mês financeiro | `financial-periods.md` |
| Métodos de pagamento (cadastro, ativação) | `payment-methods.md` |

---

## 2. Conceito

Um cartão de crédito é um **método de pagamento especializado**:

```text
PaymentMethod (kind = CREDIT_CARD)   ← nome, estado ativo/inativo, origem USER
        │ 1:1
CreditCard                           ← best_purchase_day, due_day
```

* O `PaymentMethod` é o que o usuário seleciona no lançamento.
* O `CreditCard` guarda somente a configuração de faturamento.
* Não existe método genérico `CRÉDITO`.
* Não existe `PaymentMethod` com `kind = CREDIT_CARD` sem `CreditCard` associado.
* O nome e o estado ativo/inativo do cartão existem **somente** no `PaymentMethod` associado (fonte única).

Cada cartão possui suas próprias faturas. Um lançamento de um cartão nunca pertence à fatura de outro cartão.

---

## 3. Cadastro

O usuário pode cadastrar quantos cartões desejar.

O cadastro de um cartão cria, na mesma operação atômica:

* um `PaymentMethod` com `kind = CREDIT_CARD`, `source = USER` e `active = true`;
* o `CreditCard` associado.

Um cartão não pode ser criado pelo fluxo genérico de métodos de pagamento.

### 3.1 Campos informados

| Campo | Regra |
|---|---|
| Nome | Obrigatório; 1 a 100 caracteres após trim; único entre todos os métodos de pagamento, sem diferenciar maiúsculas/minúsculas (`payment-methods.md`). |
| `best_purchase_day` (melhor dia de compra) | Inteiro de 1 a 31. |
| `due_day` (dia de vencimento) | Inteiro de 1 a 31. |

O nome é editado pelo fluxo de cartão e persistido no `PaymentMethod` associado.

---

## 4. Melhor dia de compra e dia de vencimento

* **Melhor dia de compra** é o **último dia incluído** no ciclo da fatura daquele mês. Ele define o `closing_date` (fechamento) do ciclo.
* **Dia de vencimento** é o dia em que a fatura vence. O vencimento é sempre **posterior** ao fechamento do ciclo que a fatura representa (§6.3).

Não existe restrição de ordem entre `best_purchase_day` e `due_day`. Um cartão com melhor dia 25 e vencimento dia 5 é válido: o vencimento cai no mês seguinte ao fechamento.

---

## 5. Ajuste de dias inexistentes no mês (normativo)

Todo dia configurado (melhor dia de compra, dia de vencimento e dia de vencimento de recorrência) aceita valores de 1 a 31.

Quando o mês não possui o dia configurado, usa-se o **último dia válido daquele mês**:

```text
dia_efetivo(d, mês) = min(d, último_dia(mês))
```

Exemplos:

```text
dia 31 em fevereiro/2027  → 28/02/2027
dia 31 em fevereiro/2028  → 29/02/2028
dia 30 em abril           → 30/04
dia 31 em abril           → 30/04
```

Não existem regras diferentes por quantidade de dias do mês. Esta é a única regra de ajuste do sistema; as demais specs a referenciam.

---

## 6. Ciclo, fechamento, mês de referência e vencimento (normativo)

### 6.1 Ciclo do mês M

Para um cartão, cada mês `M` possui um ciclo de compras:

```text
closing_date(M) = data(M, dia_efetivo(best_purchase_day, M))

ciclo(M) = [ closing_date(M−1) + 1 dia , closing_date(M) ]
```

* `reference_month` da fatura do ciclo `M` é **M** — o mês que contém o `closing_date`.
* O `reference_month` é o **mês financeiro** de todos os lançamentos postados naquela fatura (DEC-01).

### 6.2 Fonte do `closing_date`

* Se a fatura do ciclo `M` **já está persistida**, vale o `closing_date` gravado nela.
* Se ainda não está persistida, o `closing_date` é calculado com a configuração **vigente** do cartão.

O ciclo de uma fatura persistida **nunca** é recalculado com a configuração atual do cartão.

### 6.3 Vencimento

O `due_date` é a **primeira data estritamente posterior ao `closing_date`** cujo dia é o dia de vencimento efetivo:

```text
se dia_efetivo(due_day, M) > dia(closing_date(M))
    due_date(M) = data(M,   dia_efetivo(due_day, M))
senão
    due_date(M) = data(M+1, dia_efetivo(due_day, M+1))
```

O `due_date` é calculado uma vez, quando a fatura é persistida, e gravado nela.

### 6.4 Exemplos

**Melhor dia 6, vencimento 15:**

```text
closing_date(out) = 06/10
ciclo(out)        = 07/09 a 06/10
reference_month   = outubro
due_date          = 15/10
```

**Melhor dia 25, vencimento 5:**

```text
closing_date(out) = 25/10
ciclo(out)        = 26/09 a 25/10
reference_month   = outubro
due_date          = 05/11   (dia 5 de outubro não é posterior a 25/10)
```

**Melhor dia 10, vencimento 10:**

```text
closing_date(out) = 10/10
due_date          = 10/11   (o vencimento nunca coincide com o fechamento)
```

**Melhor dia 31, vencimento 30, fevereiro/2027:**

```text
closing_date(fev) = 28/02/2027
due_date          = 30/03/2027   (28/02 não é posterior a 28/02)
```

---

## 7. Datas de um lançamento de cartão

Um lançamento de cartão envolve datas distintas que não devem ser confundidas:

| Conceito | Onde fica | Significado |
|---|---|---|
| `purchase_date` | `Transaction` | Data em que a compra efetivamente aconteceu. Nunca muda por causa do ciclo, do cadastro tardio ou do pagamento. |
| `created_at` | `Transaction` | Momento em que o usuário registrou o lançamento no sistema. Não influencia ciclo, fatura nem mês financeiro. |
| Ciclo | derivado de `purchase_date` (§8) | Intervalo de compras ao qual a compra pertence. |
| `closing_date` | `Invoice` | Último dia do ciclo da fatura. |
| `reference_month` | `Invoice` | Mês do ciclo da fatura; é o mês financeiro dos lançamentos postados nela. |
| `due_date` | `Invoice` (copiado para `Transaction.due_date`) | Vencimento da fatura. Pode estar no mês seguinte ao `reference_month`. |
| `financial_month` | `Transaction` | Mês do impacto no planejamento. Para lançamentos de cartão é **sempre** o `reference_month` da fatura em que o lançamento está postado. |
| `paid_at` | `Transaction` e `Invoice` | Data da liquidação. |

Para lançamentos de cartão, **o mês financeiro nunca é obtido por `mês(due_date)`**. Exemplo:

```text
Melhor dia 25, vencimento 5
purchase_date     = 20/10
fatura            = outubro (closing 25/10)
due_date          = 05/11
financial_month   = outubro
```

---

## 8. Determinação da fatura de um lançamento de cartão (normativo)

Aplica-se a compras à vista, parcelas (primeira parcela) e ocorrências de recorrência paga com cartão.

### 8.1 Ciclo da compra

Seja `M` o mês da `purchase_date`:

```text
se purchase_date <= closing_date(M)   → ciclo M
senão                                 → ciclo M+1
```

(`closing_date` conforme §6.2.)

O ciclo depende **apenas** da `purchase_date`. A data do cadastro (`created_at`) e o fato de a fatura já ter passado do melhor dia **não** mudam o ciclo.

Exemplo — melhor dia 6, vencimento 15:

```text
Compra em 05/10 cadastrada em 20/10
→ ciclo de outubro
→ se a fatura de outubro não estiver PAID, a compra é postada nela (mesmo estando CLOSED)
```

### 8.2 Fatura de postagem

A compra é postada na fatura do seu ciclo, **exceto** quando essa fatura:

* está `PAID`; ou
* pertence a um mês financeiro `CLOSED`.

Nesses casos aplica-se a regra da **compra tardia**:

* a compra é postada na **próxima fatura do mesmo cartão** que não esteja `PAID` e cujo mês financeiro esteja aberto, percorrendo os ciclos seguintes em ordem;
* a `purchase_date` original é preservada;
* a fatura `PAID` não é reaberta nem alterada (inclusive a fatura paga antes do `closing_date`, PD-32);
* o mês financeiro da compra passa a ser o `reference_month` da fatura em que foi postada.

Exemplo:

```text
Melhor dia 6, vencimento 15
Fatura de outubro: PAID em 14/10

Compra de 05/10 cadastrada em 20/10
→ ciclo de outubro (pela purchase_date)
→ fatura de outubro está PAID
→ postada na fatura de novembro
→ purchase_date = 05/10 (preservada)
→ financial_month = novembro
```

Uma compra tardia é identificável sem campo próprio: sua `purchase_date` é anterior ao início do ciclo da fatura em que está postada.

### 8.3 Fatura ainda não persistida

Se a fatura de postagem ainda não existe, ela é criada com `status = OPEN`, `closing_date` e `due_date` calculados conforme §6. Se o `closing_date` já passou, ela passa imediatamente a `CLOSED` (ver `invoices.md`).

---

## 9. Registro de compras de cartão

* **Compras futuras** são permitidas (`purchase_date` posterior a hoje); a fatura é determinada pela §8.
* **Compras retroativas** são permitidas somente com `purchase_date` dentro do mês corrente (do dia 1 até hoje), conforme a regra geral de criação retroativa de `transactions.md`.

Exemplo, hoje = 29/09:

```text
10/09 → permitido
05/10 → permitido (compra futura)
10/08 → não permitido
```

A regra de janela não se aplica a lançamentos gerados pelo sistema (parcelas seguintes e ocorrências de recorrência).

---

## 10. Tipos de lançamento de cartão

| Tipo | `origin` | Fonte |
|---|---|---|
| Compra à vista | `CREDIT_CARD` | esta spec + `transactions.md` |
| Parcela de compra parcelada | `INSTALLMENT` | `installments.md` |
| Ocorrência de recorrência paga com cartão | `RECURRENCE` | `recurrences.md` |

Uma compra à vista gera um único lançamento em uma única fatura. Uma compra em `1x` é compra à vista.

---

## 11. Imutabilidade da compra realizada

Depois que uma compra de cartão é registrada, não podem ser alterados:

* valor (exceção: ocorrência de recorrência com cartão, editável enquanto a fatura não estiver `PAID` — `recurrences.md` §9);
* cartão;
* número de parcelas (compras parceladas);
* `purchase_date` (PD-27). Na ocorrência de recorrência com cartão, ela deriva da recorrência (`recurrences.md`).

Lançamentos de cartão são liquidados somente pelo pagamento da fatura (`invoices.md` §9.3).

A descrição e a categoria seguem a matriz de edição de `transactions.md` §12. Nenhum campo de lançamento postado em fatura `PAID` pode ser editado.

Compras de cartão **não são excluídas fisicamente**. Para desfazer financeiramente uma compra, usa-se o estorno (`refunds.md`).

---

## 12. Alteração da configuração do cartão

O usuário pode alterar o nome, `best_purchase_day` e `due_day`.

* A alteração **não modifica** faturas já persistidas: elas mantêm `closing_date`, `due_date` e `reference_month`.
* Compras, parcelas e ocorrências já postadas permanecem nas faturas em que estão.
* A nova configuração vale somente para ciclos cuja fatura ainda não foi persistida.

Consequência de §6.2 — exemplo:

```text
Fatura de outubro persistida com closing_date = 06/10
Usuário altera o melhor dia de 6 para 10 em 03/10

Compra em 08/10:
closing_date(out) = 06/10 (gravado)  → 08/10 > 06/10
→ ciclo de novembro, closing_date(nov) = 10/11 (configuração nova)
```

Faturas futuras já persistidas (por exemplo, criadas por parcelas de um parcelamento) também preservam seu ciclo e vencimento originais.

---

## 13. Desativação e reativação

O estado do cartão é o campo `active` do `PaymentMethod` associado.

A desativação:

* impede novas compras e novas ocorrências de recorrência com o cartão (`recurrences.md`);
* não remove nem altera faturas, compras, parcelas ou ocorrências existentes;
* não cancela parcelas futuras já programadas: elas continuam em suas faturas, que continuam exibidas e pagáveis.

A reativação:

* volta a permitir novas compras;
* não cria lançamentos retroativos.

Quando o cartão está desativado e não possui mais faturas com lançamentos futuros, ele deixa de aparecer na visão de faturas futuras, sem perder histórico.

O cartão nunca é excluído.

---

## 14. Limite de crédito

Fora do MVP: limite total, limite disponível, bloqueio por limite e comprometimento por parcelamento.

---

## 15. Regras de negócio

* **RN-CAR-01** — O usuário pode cadastrar múltiplos cartões.
* **RN-CAR-02** — Cartão é um `PaymentMethod` com `kind = CREDIT_CARD` e um `CreditCard` associado (1:1); um não existe sem o outro.
* **RN-CAR-03** — Nome e estado ativo do cartão existem somente no `PaymentMethod`.
* **RN-CAR-04** — `best_purchase_day` e `due_day` aceitam 1 a 31.
* **RN-CAR-05** — Dias inexistentes no mês usam o último dia válido do mês (§5).
* **RN-CAR-06** — O melhor dia é o último dia incluído no ciclo; define o `closing_date`.
* **RN-CAR-07** — O `reference_month` da fatura é o mês do seu `closing_date`.
* **RN-CAR-08** — O vencimento é a primeira data com o dia de vencimento efetivo estritamente posterior ao `closing_date`.
* **RN-CAR-09** — O ciclo de uma compra é determinado somente pela `purchase_date`.
* **RN-CAR-10** — O ciclo de uma fatura persistida usa o `closing_date` gravado, nunca a configuração atual.
* **RN-CAR-11** — Compra cujo ciclo pertence a fatura `PAID` ou a mês fechado é postada na próxima fatura não paga, com mês aberto, do mesmo cartão (compra tardia), preservando a `purchase_date`.
* **RN-CAR-12** — O mês financeiro de lançamento de cartão é o `reference_month` da fatura de postagem, nunca `mês(due_date)`.
* **RN-CAR-13** — Compras futuras são permitidas; retroativas somente com `purchase_date` no mês corrente até hoje.
* **RN-CAR-14** — Valor, cartão, número de parcelas e `purchase_date` de compra realizada são imutáveis.
* **RN-CAR-15** — Compras de cartão não são excluídas; usam estorno.
* **RN-CAR-16** — Alterações de configuração não modificam faturas persistidas nem lançamentos postados.
* **RN-CAR-17** — Desativação impede novas compras e novas ocorrências; preserva todo o histórico e as parcelas futuras.
* **RN-CAR-18** — Reativação não cria lançamentos retroativos.
* **RN-CAR-19** — Controle de limite não faz parte do MVP.

---

## 16. Critérios de aceitação

* **CA-CAR-01** — Cadastrar cartão cria `PaymentMethod` (`CREDIT_CARD`) e `CreditCard` atomicamente.
* **CA-CAR-02** — Melhor dia 6: compras em 05/10 e 06/10 → ciclo de outubro; 07/10 → ciclo de novembro.
* **CA-CAR-03** — Melhor dia 6, vencimento 15: fatura de outubro vence 15/10.
* **CA-CAR-04** — Melhor dia 25, vencimento 5: compra em 20/10 → fatura de outubro, vencimento 05/11, mês financeiro outubro.
* **CA-CAR-05** — Melhor dia 25, vencimento 5: compra em 26/10 → fatura de novembro, vencimento 05/12.
* **CA-CAR-06** — Melhor dia 31 em fevereiro/2027 → `closing_date` 28/02/2027.
* **CA-CAR-07** — Vencimento nunca é igual ou anterior ao `closing_date`.
* **CA-CAR-08** — Compra de 05/10 cadastrada em 20/10 (melhor dia 6) com fatura de outubro `CLOSED` e não paga → postada na fatura de outubro.
* **CA-CAR-09** — Mesma compra com fatura de outubro `PAID` → postada na fatura de novembro, `purchase_date` = 05/10, mês financeiro novembro, fatura de outubro inalterada.
* **CA-CAR-10** — Alteração do melhor dia não move compras existentes nem altera `closing_date`/`due_date` de faturas persistidas.
* **CA-CAR-11** — Com fatura de outubro persistida (closing 06/10) e melhor dia alterado para 10, compra em 08/10 → ciclo de novembro.
* **CA-CAR-12** — Tentativa de alterar valor ou cartão de compra realizada é rejeitada.
* **CA-CAR-13** — Tentativa de excluir compra de cartão é rejeitada.
* **CA-CAR-14** — Cartão desativado: nova compra é rejeitada; parcelas futuras continuam existindo.
* **CA-CAR-15** — Hoje 29/09: compra com `purchase_date` 10/08 é rejeitada; 10/09 e 05/10 são aceitas.
* **CA-CAR-16** — Tentativa de alterar a `purchase_date` de compra à vista é rejeitada.

---

## 17. Testes obrigatórios

* criação atômica de cartão; nome único entre métodos;
* ajuste de dias 29/30/31 em meses curtos (inclusive ano bissexto);
* `closing_date`, `reference_month` e `due_date` para combinações de melhor dia e vencimento (vencimento no mesmo mês e no mês seguinte; dias iguais);
* compra antes, no e depois do melhor dia;
* compra retroativa em fatura `CLOSED`;
* compra tardia com fatura do ciclo `PAID` e com mês do ciclo fechado;
* preservação de `closing_date`/`due_date` após alteração de configuração;
* ciclo seguinte após alteração do melhor dia com fatura persistida;
* `financial_month` = `reference_month` (nunca `mês(due_date)`);
* janela de registro (retroativa, futura, mês anterior);
* desativação e reativação sem retroatividade.

---

## 18. Fora do escopo do MVP

Limite de crédito, juros, multa, encargos, rotativo, pagamento mínimo, cartões adicionais, cashback, pontos, integração com operadoras ou bancos, Open Banking, conciliação automática e pagamento automático.
