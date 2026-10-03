# Spec — Recorrências

## 1. Objetivo

Definir as recorrências mensais: entradas ou saídas que se repetem todo mês sem que o usuário precise cadastrar cada mês.

Esta spec é a **fonte normativa** para:

* a distinção entre recorrência (regra) e ocorrência (lançamento);
* quando uma ocorrência é projetada e quando é gerada;
* efeito de alterações, pausa, cancelamento e exceções (ocorrência pulada);
* bloqueio por método, categoria ou cartão inativos;
* recorrências pagas com cartão.

Regras referenciadas:

| Assunto | Fonte normativa |
|---|---|
| Ajuste de dias 29/30/31 | `credit-cards.md` §5 |
| Fatura de postagem de ocorrência de cartão | `credit-cards.md` §8 |
| Regras gerais de lançamento e edição | `transactions.md` |
| Estorno de ocorrência de cartão | `refunds.md` |
| Fechamento do mês | `financial-periods.md` |

---

## 2. Conceitos

```text
RECORRÊNCIA  → regra/configuração (Recurrence)
OCORRÊNCIA   → lançamento de um mês (Transaction, origin = RECURRENCE)
EXCEÇÃO      → registro de que a ocorrência de um mês foi pulada (RecurrenceException)
```

* Recorrência e parcelamento são conceitos diferentes. A recorrência não tem número de parcelas e pode ser indeterminada.
* A natureza financeira (entrada ou saída) vem da categoria da recorrência.
* A única frequência do MVP é **mensal**.

---

## 3. Estrutura

```text
Recurrence
├── id
├── description
├── amount               (centavos, > 0)
├── category_id
├── payment_method_id    (pode ser um cartão de crédito)
├── due_day              (1..31)
├── start_date
├── end_date             (opcional)
├── status               (ACTIVE | PAUSED | CANCELLED)
├── paused_from          (início da pausa; opcional)
├── paused_until         (retorno programado; opcional)
├── created_at
└── updated_at

RecurrenceException
├── id
├── recurrence_id
├── occurrence_month     (YYYY-MM)
└── created_at
```

Ocorrência gerada (`Transaction`): `origin = RECURRENCE`, `recurrence_id` e `occurrence_month`. O par `(recurrence_id, occurrence_month)` é único entre ocorrências e exceções.

A única exceção existente no MVP é "ocorrência pulada"; por isso `RecurrenceException` não possui campo de tipo.

---

## 4. Data e mês da ocorrência

* A ocorrência do mês `M` tem data `data(M, dia_efetivo(due_day, M))` (`credit-cards.md` §5). Exemplo: `due_day = 31` em fevereiro → último dia de fevereiro.
* Recorrência com método comum: o mês financeiro da ocorrência é o mês da sua data, que é o seu `due_date`.
* Recorrência com cartão: ver §13.

---

## 5. Elegibilidade de uma ocorrência (normativo)

A recorrência produz ocorrência no mês `M` somente se todas as condições forem verdadeiras:

1. a data da ocorrência é igual ou posterior à `start_date` e à data de criação da recorrência (não há ocorrência retroativa);
2. não há `end_date`, ou a data da ocorrência é igual ou anterior a ela;
3. a recorrência não está `CANCELLED` na data da ocorrência;
4. a data da ocorrência não está dentro de uma pausa;
5. não existe exceção (`RecurrenceException`) para `M`;
6. o método de pagamento e a categoria (e o cartão, que é o próprio método) estão ativos na data da ocorrência;
7. para recorrência com método comum, o mês financeiro da ocorrência não está fechado. Para recorrência com cartão, a ocorrência segue a regra de fatura de postagem, inclusive a de compra tardia (`credit-cards.md` §8).

Exemplo — criada em 20/09 com vencimento dia 10:

```text
Setembro → nenhuma ocorrência (10/09 é anterior à criação)
Outubro  → 10/10
Novembro → 10/11
```

---

## 6. Ocorrência projetada e ocorrência gerada (normativo)

O sistema não cria registros infinitos. A recorrência é a fonte das ocorrências ainda não geradas.

* **Projetada** — ocorrência elegível cuja data é **futura** e com a qual o usuário ainda não interagiu. Não é persistida e é calculada a partir da configuração **atual** da recorrência.
* **Gerada** — ocorrência persistida como `Transaction`. Uma ocorrência é gerada:
  * quando a sua data chega (data ≤ hoje), com a configuração vigente nesse momento; ou
  * antes da data, quando o usuário interage com ela (paga ou edita).

Pular uma ocorrência projetada não a gera: apenas registra a exceção (§10). Estorno exige ocorrência gerada de cartão, cuja data já chegou (`refunds.md` §6).

Uma ocorrência gerada é um lançamento independente: mudanças posteriores na recorrência não a alteram.

Para o planejamento:

* ocorrências projetadas aparecem na Home dos meses futuros como lançamentos previstos `PENDING` (`home.md`);
* a geração na data da ocorrência é garantida pelo sistema, independentemente de acesso do usuário (`architecture.md`).

---

## 7. Valor, descrição e vencimento

* Valor maior que zero, sem limite de negócio (limite técnico do banco).
* Descrição obrigatória, de 1 a 200 caracteres após trim, usada nas ocorrências.
* Dia de vencimento de 1 a 31, com ajuste para meses curtos.

---

## 8. Alterações na recorrência (normativo, PD-11)

Podem ser alterados: descrição, valor, dia de vencimento, categoria, método de pagamento (inclusive cartão), `end_date`.

* A alteração vale **imediatamente** para todas as ocorrências **ainda não geradas**, ou seja, para as projetadas.
* Ocorrências já geradas **nunca** são alteradas automaticamente.
* Meses fechados nunca são alterados.

Exemplo:

```text
Aluguel — R$ 1.500 — dia 8
Hoje: 05/03 (ocorrência de março ainda não gerada)
Usuário altera o valor para R$ 1.600

Janeiro   → R$ 1.500 (gerada)
Fevereiro → R$ 1.500 (gerada)
Março     → R$ 1.600 (projetada → usa o valor novo)
Abril     → R$ 1.600
```

Se a alteração fosse feita em 10/03, a ocorrência de 08/03 já teria sido gerada com R$ 1.500 e não mudaria; o novo valor valeria a partir de abril.

A nova categoria e o novo método devem estar ativos.

---

## 9. Edição individual de ocorrência

Uma ocorrência pode ser editada individualmente enquanto o seu mês financeiro estiver aberto. Editar uma ocorrência projetada gera essa ocorrência com os valores editados.

| Campo | Ocorrência com método comum | Ocorrência com cartão |
|---|---|---|
| Descrição | editável | editável enquanto a fatura não estiver `PAID` |
| Valor | editável | editável enquanto a fatura não estiver `PAID` (PD-27) |
| Data/vencimento | editável (regras de `transactions.md`) | não (deriva da recorrência e da fatura) |
| Método | editável entre métodos comuns ativos | não |
| Categoria | **não** — pertence à recorrência | **não** |
| Status | `PENDING` ⇄ `PAID` | somente pelo pagamento da fatura (`invoices.md` §9.3) |

A edição individual não altera a recorrência nem as demais ocorrências.

---

## 10. Pular ocorrência (PD-19)

O usuário pode pular a ocorrência de um mês sem cancelar a recorrência.

* Pular cria uma `RecurrenceException` para aquele mês; a recorrência permanece intacta.
* A ocorrência pulada não aparece no planejamento e não volta a ser gerada.
* Uma ocorrência **projetada** (futura) pode ser pulada.
* Uma ocorrência **gerada**, com método comum e ainda `PENDING`, pode ser pulada (PD-28): o lançamento é removido fisicamente e substituído pela exceção na mesma operação.
* Uma ocorrência já `PAID` não pode ser pulada nem excluída.
* Uma ocorrência gerada com cartão é uma compra de cartão: não pode ser pulada nem excluída; usa-se o estorno (`refunds.md`).
* Só é possível pular ocorrências de meses abertos.

Exemplo:

```text
Aluguel via PIX, dia 05. Hoje 10/10.
A ocorrência de outubro foi gerada em 05/10 e está em aberto.
Pular outubro → lançamento removido + exceção para outubro.
Novembro continua normalmente.
```

---

## 11. Pausa

* Uma recorrência `ACTIVE` pode ser pausada, indefinidamente ou com retorno programado.
* A pausa tem início (`paused_from`, hoje ou uma data futura) e retorno opcional (`paused_until`).
* Ocorrências com data no intervalo da pausa não são geradas. Ao retornar, **não** são criadas ocorrências retroativas.
* Ocorrências já geradas não são removidas.
* O status é `PAUSED` enquanto a pausa estiver vigente e volta a `ACTIVE` ao atingir `paused_until` ou quando o usuário retoma.
* A pausa não apaga histórico nem configuração.

Exemplo:

```text
Netflix — pausa de 01/01/2027 a 01/04/2027
Dezembro/2026 → ocorrência normal
Janeiro, fevereiro e março/2027 → sem ocorrência
Abril/2027 → volta a gerar
```

---

## 12. Cancelamento

* Cancelar encerra a recorrência definitivamente (`CANCELLED`).
* Nenhuma ocorrência com data posterior ao cancelamento é gerada; as projetadas deixam de existir.
* Ocorrências já geradas permanecem.
* A recorrência cancelada não volta a gerar; para retomar, cria-se uma nova recorrência.
* Cancelar não equivale a estornar.

Atingir a `end_date` não muda o status; a recorrência apenas deixa de produzir ocorrências.

---

## 13. Recorrência paga com cartão (PD-09)

* Cada ocorrência é uma nova compra no cartão; **não** é parcela.
* A data da ocorrência (dia `due_day`) é a data da cobrança e funciona como `purchase_date` para determinar a fatura (`credit-cards.md` §8).
* O mês financeiro da ocorrência é o `reference_month` da fatura de postagem, como em qualquer lançamento de cartão.
* Projeções de ocorrências de cartão usam o ciclo projetado do cartão.
* Alterar o cartão da recorrência afeta somente ocorrências ainda não geradas; as geradas permanecem no cartão original.

Exemplo — melhor dia 6, vencimento 15, Netflix todo dia 10:

```text
Ocorrência de 10/10 → ciclo de novembro → fatura de novembro (vence 15/11) → mês financeiro novembro
```

---

## 14. Método, categoria ou cartão inativo (PD-10)

* Se o método de pagamento (inclusive cartão) ou a categoria da recorrência estiver inativo, ocorrências com data nesse período **não são geradas** nem projetadas.
* A recorrência mantém status, método e categoria; o sistema não troca nada automaticamente e não cria estado adicional.
* Na reativação, a recorrência volta a produzir ocorrências a partir da primeira data de ocorrência igual ou posterior à reativação. Ocorrências do período inativo não são geradas retroativamente.
* Projeções de meses futuros usam o estado atual: enquanto o método ou a categoria estiver inativo, nenhuma ocorrência futura é projetada.

Exemplo:

```text
Netflix — Cartão Nubank — ACTIVE
Janeiro, fevereiro → geradas
Cartão desativado em 01/03
Março, abril → não geradas
Cartão reativado em 05/05
Maio (dia 10) → gerada normalmente
```

---

## 15. Status de pagamento da ocorrência

* Cada ocorrência gerada tem status próprio (`PENDING`/`PAID`). Ocorrências com cartão são liquidadas somente pelo pagamento da fatura.
* Alterar o status de uma ocorrência não altera a recorrência nem as demais ocorrências.
* Ocorrências projetadas contam como `PENDING` para o planejamento e para o fechamento do mês (`financial-periods.md`).

---

## 16. Estorno

Somente ocorrências pagas com cartão podem ser estornadas (`refunds.md`). O estorno afeta somente aquela ocorrência e não cancela nem altera a recorrência. Ocorrências pagas com outros métodos não são estornadas.

---

## 17. Meses fechados

Ocorrências de meses fechados são imutáveis. Nenhuma alteração da recorrência, pausa, cancelamento ou exceção atinge um mês fechado.

---

## 18. Regras de negócio

* **RN-REC-01** — Recorrência é regra; ocorrência é lançamento (`origin = RECURRENCE`).
* **RN-REC-02** — Frequência única: mensal.
* **RN-REC-03** — Descrição, valor > 0, categoria, método, dia de vencimento (1..31) e `start_date` são obrigatórios; `end_date` é opcional.
* **RN-REC-04** — Não há ocorrência com data anterior à criação da recorrência.
* **RN-REC-05** — Ocorrência futura não gerada é projetada a partir da configuração atual.
* **RN-REC-06** — A ocorrência é gerada na sua data, ou antes se o usuário interagir com ela.
* **RN-REC-07** — Alterações na recorrência afetam somente ocorrências ainda não geradas.
* **RN-REC-08** — Ocorrências geradas nunca são alteradas automaticamente.
* **RN-REC-09** — A categoria pertence à recorrência e não pode ser alterada em uma ocorrência isolada.
* **RN-REC-10** — Edição individual não altera a recorrência.
* **RN-REC-11** — Pular uma ocorrência cria uma exceção explícita para o mês e não altera a recorrência.
* **RN-REC-12** — Ocorrência paga não pode ser pulada nem excluída; ocorrência gerada com método comum e `PENDING` pode ser pulada (remoção do lançamento + exceção); ocorrência gerada com cartão não pode ser pulada.
* **RN-REC-13** — Pausa impede ocorrências no intervalo; a retomada não cria ocorrências retroativas.
* **RN-REC-14** — Cancelamento é definitivo e preserva as ocorrências geradas.
* **RN-REC-15** — Método, categoria ou cartão inativo bloqueia ocorrências sem mudar o status da recorrência; a reativação não gera retroativamente.
* **RN-REC-16** — Ocorrência de cartão é compra no cartão, postada pela regra da `purchase_date` (= data da ocorrência); mês financeiro = mês da fatura.
* **RN-REC-17** — Somente ocorrências de cartão podem ser estornadas.
* **RN-REC-18** — Ocorrências de meses fechados são imutáveis.
* **RN-REC-19** — Estados: `ACTIVE`, `PAUSED`, `CANCELLED`.

---

## 19. Critérios de aceitação

* **CA-REC-01** — Criar recorrência mensal com e sem `end_date`.
* **CA-REC-02** — Criada em 20/09 com dia 10 → primeira ocorrência em 10/10.
* **CA-REC-03** — Dia 31 → ocorrência em 28/02 (ou 29/02 em ano bissexto).
* **CA-REC-04** — Consultar um mês distante exibe a ocorrência projetada sem que os meses intermediários existam no banco.
* **CA-REC-05** — Alterar o valor em 05/03 (dia 8) muda março e os meses seguintes; alterar em 10/03 muda a partir de abril.
* **CA-REC-06** — Ocorrência gerada não muda quando a recorrência muda.
* **CA-REC-07** — Editar o valor de uma ocorrência com método comum, ou de uma ocorrência com cartão em fatura não paga, não altera a recorrência.
* **CA-REC-07A** — Editar o valor de ocorrência com cartão em fatura `PAID` é rejeitado.
* **CA-REC-08** — Tentar alterar a categoria de uma ocorrência isolada é rejeitado.
* **CA-REC-09** — Pular a ocorrência projetada de dezembro cria exceção; dezembro fica sem ocorrência; janeiro continua.
* **CA-REC-10** — Tentar pular ocorrência paga é rejeitado.
* **CA-REC-10A** — Pular a ocorrência de outubro (PIX, gerada em 05/10, em aberto) remove o lançamento e cria a exceção; novembro continua.
* **CA-REC-10B** — Tentar pular ocorrência gerada com cartão é rejeitado.
* **CA-REC-11** — Pausa de janeiro a março: sem ocorrências nesses meses; abril volta; nada retroativo.
* **CA-REC-12** — Cancelamento: ocorrências geradas permanecem; nenhuma nova é gerada; a recorrência não volta automaticamente.
* **CA-REC-13** — Cartão desativado em março e reativado em 05/05: março e abril sem ocorrência; maio gerado; status sempre `ACTIVE`.
* **CA-REC-14** — Ocorrência de cartão em 10/10 com melhor dia 6 → fatura de novembro; mês financeiro novembro.
* **CA-REC-15** — Estorno de ocorrência de cartão não altera as ocorrências seguintes; estorno de ocorrência via PIX é rejeitado.
* **CA-REC-16** — Ocorrências de meses fechados não mudam com alterações, pausa ou cancelamento.
* **CA-REC-17** — Recorrências de entrada e de saída são suportadas.

---

## 20. Testes obrigatórios

* elegibilidade (início, término, criação no meio do mês, pausa, cancelamento, exceção, inativos, mês fechado);
* ajuste de dias 29/30/31;
* projeção sem materialização em meses distantes;
* geração na data e por interação; idempotência (uma ocorrência por mês);
* alterações afetando somente ocorrências não geradas;
* edição individual por campo;
* pular ocorrência;
* pausa com e sem retorno; retomada sem retroatividade;
* cancelamento;
* recorrência com cartão: fatura, mês financeiro e troca de cartão;
* bloqueio e reativação de método, categoria e cartão;
* estorno somente de ocorrência de cartão.

---

## 21. Fora do escopo do MVP

Frequências semanal, quinzenal e anual; múltiplos vencimentos no mesmo mês; notificações; cobrança automática; integração bancária; boletos; transferências; previsão baseada em histórico.
