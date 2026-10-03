# Feature Spec — Home

## 1. Objetivo

A Home é a tela principal. Ela apresenta o **extrato previsto** de um mês e permite:

* navegar entre meses passados, atual e futuros;
* ver entradas, saídas e saldo previstos;
* ver o status de pagamento dos lançamentos;
* criar lançamentos;
* fechar o mês.

A Home representa planejamento, não saldo bancário realizado. Ela apenas apresenta: os cálculos e as validações são do backend.

---

## 2. Saldo previsto

```text
Saldo previsto = Entradas previstas − Saídas previstas
```

* **Entradas previstas** = soma dos itens do mês com categoria `INCOME` − créditos de estorno reconhecidos no mês sobre compras de categoria `INCOME`.
* **Saídas previstas** = soma dos itens do mês com categoria `EXPENSE` − créditos de estorno reconhecidos no mês sobre compras de categoria `EXPENSE` (`refunds.md` §9).
* Entram itens `PENDING` e `PAID`: o status não altera o saldo previsto.
* O pagamento de fatura não entra no cálculo: não é lançamento (`invoices.md`).
* O saldo credor transportado entre faturas não entra no cálculo (`invoices.md` §8).

Exemplo:

```text
Salário    + R$ 8.500   Pago
Aluguel    − R$ 1.500   Pago
Internet   − R$   120   Em aberto

Saldo previsto = 8.500 − 1.500 − 120 = R$ 6.880
```

---

## 3. Itens do extrato de um mês

O extrato do mês `M` contém, conforme o mês financeiro de cada item (`financial-periods.md` §3):

| Item | Apresentação |
|---|---|
| Lançamento manual | uma linha |
| Compra à vista no cartão | uma linha, com a data da compra e o cartão (o vencimento da fatura fica disponível como informação) |
| Parcela | uma linha por parcela, com o número (`2/10`) e acesso à compra original (plano) |
| Ocorrência de recorrência gerada | uma linha, identificada como recorrência |
| Ocorrência de recorrência projetada | uma linha prevista, `Em aberto`, identificada como recorrência |
| Crédito de estorno | uma linha de crédito vinculada à compra original, sem status |

Regras:

* Não existe linha agregada por cartão ou por fatura. Cada compra, parcela ou ocorrência de cartão é um item.
* Não existe linha para o plano de parcelamento (sem transação-mãe). O impacto vem somente das parcelas.
* Cada item mostra, no mínimo: data, descrição, valor com sinal, natureza e status (créditos de estorno não têm status).

Exemplo de parcela:

```text
Mercado Livre — Coxim do motor — 2/10 — R$ 59,00
```

### 3.1 Data exibida (PD-25)

| Item | Data exibida |
|---|---|
| Lançamento com método comum (manual ou ocorrência de recorrência) | `due_date` |
| Lançamento de cartão (compra à vista, parcela, ocorrência de recorrência com cartão) | `purchase_date` (data da compra) |
| Crédito de estorno | `refund_date` |

* Um item de cartão aparece no extrato do mês da sua fatura, mesmo que a data da compra seja de um mês anterior. Exemplo, com melhor dia 6: compra em 20/12 aparece no extrato de janeiro com a data 20/12.
* Todas as parcelas de um parcelamento exibem a mesma data (a data da compra do plano), cada uma no mês da sua fatura.
* O vencimento da fatura continua disponível como informação do item de cartão.
* O extrato é ordenado pela data exibida.

---

## 4. Exemplo do extrato

Cartão Nubank com melhor dia 6 e vencimento 15. Mês: janeiro/2027. Todos os itens de cartão abaixo estão na fatura Nubank de janeiro/2027 (ciclo 07/12 a 06/01, vencimento 15/01).

```text
‹ JANEIRO 2027 ›                                  ABERTO

ENTRADAS PREVISTAS                            R$ 8.800,00
SAÍDAS PREVISTAS                              R$ 2.759,00
SALDO PREVISTO                                R$ 6.041,00

EXTRATO

28/11  Mercado Livre — Coxim do motor · 2/10  − R$    59,00   Em aberto
10/12  Netflix · Nubank · recorrência         − R$    60,00   Em aberto
20/12  Supermercado · Nubank                  − R$   640,00   Em aberto
03/01  Estorno — Tênis · Nubank               + R$   100,00   Crédito
05/01  Salário                                + R$ 8.500,00   Pago
05/01  Aluguel                                − R$ 1.500,00   Em aberto
06/01  Internet                               − R$   120,00   Em aberto
07/01  Gasolina                               − R$   300,00   Em aberto
10/01  Luz                                    − R$   180,00   Em aberto
20/01  Freelance                              + R$   300,00   Em aberto

SALDO PREVISTO                                R$ 6.041,00

[ + Lançamento ]                              [ Fechar mês ]
```

* A parcela 1/10 do Coxim do motor (compra em 28/11) está na fatura de dezembro; a 2/10 está na de janeiro.
* O crédito do estorno, com data 03/01, foi reconhecido na fatura de janeiro, que estava `OPEN`.
* Os itens de cartão ficam `Em aberto` até o pagamento da fatura de janeiro (`invoices.md` §9.3).

Cálculo: saídas 1.500 + 120 + 300 + 180 + 640 + 59 + 60 = 2.859; menos o estorno de 100 = 2.759. Entradas 8.500 + 300 = 8.800.

---

## 5. Seleção do mês

* Navegação para o mês anterior, o seguinte, o atual e qualquer mês passado ou futuro.
* Meses sem registro persistido são exibidos normalmente (`financial-periods.md` §2).
* Meses futuros mostram lançamentos já existentes (inclusive parcelas futuras) e ocorrências projetadas.

---

## 6. Estado do mês

Cada mês exibe o seu estado:

```text
OPEN   → Aberto
CLOSED → Fechado
```

Em mês fechado, as ações de alteração ficam indisponíveis e o mês fica claramente identificado como fechado. Os dados continuam consultáveis exatamente como no fechamento, inclusive categorias e métodos depois desativados.

---

## 7. Ações

* **+ Lançamento** — abre o formulário de lançamento (entrada ou saída, descrição, valor, data, categoria, método e, para cartão, parcelamento). Recorrências são criadas pelo fluxo de recorrências. As regras são as de `transactions.md` e das specs de cartão.
* **Fechar mês** — disponível com o mês aberto; pede confirmação explícita com aviso de irreversibilidade e imutabilidade; segue as pré-condições de `financial-periods.md` §4.1. Se rejeitado, informa o motivo.

Mensagem de confirmação:

```text
Fechar janeiro/2027?

Ao fechar o mês, todos os lançamentos deste período ficarão imutáveis.
O mês não poderá ser reaberto.

[ Cancelar ] [ Fechar mês ]
```

---

## 8. Regras de negócio

* **RN-HOME-01** — Qualquer mês pode ser consultado.
* **RN-HOME-02** — Saldo previsto = Entradas previstas − Saídas previstas, com os créditos de estorno abatidos das saídas.
* **RN-HOME-03** — O status de pagamento não altera o saldo previsto.
* **RN-HOME-04** — Cada compra, parcela e ocorrência de cartão aparece individualmente no mês da sua fatura; não há linha agregada nem transação-mãe.
* **RN-HOME-05** — A parcela mostra `n/N` e dá acesso à compra original.
* **RN-HOME-06** — Ocorrências projetadas aparecem como previstas `Em aberto`.
* **RN-HOME-06A** — Data exibida: `due_date` para método comum, `purchase_date` para cartão, `refund_date` para créditos de estorno.
* **RN-HOME-07** — Fechamento é manual, confirmado, irreversível e segue `financial-periods.md`.
* **RN-HOME-08** — Mês fechado é exibido como fechado, sem ações de alteração.

---

## 9. Critérios de aceitação

* **CA-HOME-01** — Navegar para outro mês mostra os dados daquele mês.
* **CA-HOME-02** — Entradas R$ 8.800 e saídas R$ 2.759 → saldo R$ 6.041.
* **CA-HOME-03** — Marcar item como pago muda o status sem mudar o saldo.
* **CA-HOME-04** — Compra de 07/10 com melhor dia 6 aparece em novembro.
* **CA-HOME-05** — Compra de 20/10 com melhor dia 25 e vencimento 5 aparece em outubro.
* **CA-HOME-06** — Compra parcelada em 10x aparece como uma parcela em cada mês, com `n/10`, sem linha com o valor total.
* **CA-HOME-07** — Estorno de R$ 100 reconhecido no mês reduz as saídas previstas em R$ 100.
* **CA-HOME-08** — Pagar a fatura não altera os totais.
* **CA-HOME-09** — Mês futuro mostra ocorrências projetadas de recorrências ativas.
* **CA-HOME-10** — Fechar mês pede confirmação; com pendência, é rejeitado com o motivo.
* **CA-HOME-11** — Mês fechado é exibido como fechado e sem ações de alteração.
* **CA-HOME-12** — Compra de 20/12 na fatura de janeiro aparece no extrato de janeiro com a data 20/12.

---

## 10. Testes obrigatórios

* totais (entradas, saídas com estornos, saldo) e independência do status;
* inclusão por mês financeiro (comum, cartão, parcelas, projeções, créditos de estorno);
* ausência de linha agregada e de transação-mãe;
* identificação de parcela `n/N` e vínculo com o plano;
* data exibida por tipo de item e ordenação;
* navegação entre meses;
* fechamento com confirmação e rejeições;
* exibição de mês fechado.

---

## 11. Fora de escopo

Dashboards, gráficos, relatórios avançados, orçamento, metas, saldo bancário realizado, conciliação e investimentos.
