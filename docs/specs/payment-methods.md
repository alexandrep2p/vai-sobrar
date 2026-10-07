# Feature Spec — Métodos de Pagamento

## 1. Objetivo

Permitir que o usuário gerencie as formas usadas para pagar ou receber lançamentos.

O método de pagamento (`PaymentMethod`) é o que o usuário seleciona no lançamento. Um cartão de crédito é um método especializado (`kind = CREDIT_CARD`), com configuração de faturamento em `CreditCard` (`credit-cards.md`).

Métodos usados no histórico nunca são excluídos: são desativados.

---

## 2. Estrutura

```text
PaymentMethod
├── id
├── name
├── source      (SYSTEM | USER)
├── kind        (STANDARD | CREDIT_CARD)
├── active      (booleano)
├── created_at
└── updated_at
```

| Enum | Valor | Label na UI |
|---|---|---|
| `source` | `SYSTEM` | Sistema |
| `source` | `USER` | Personalizado |
| `kind` | `STANDARD` | Comum |
| `kind` | `CREDIT_CARD` | Cartão de crédito |

* `name` e `active` do cartão existem somente aqui (fonte única). `CreditCard` não repete esses campos.
* Um método `CREDIT_CARD` sempre tem exatamente um `CreditCard` associado.

---

## 3. Métodos do sistema

Na criação de cada conta (PD-40), o sistema fornece ao usuário:

```text
PIX
Dinheiro
Débito
```

Com `source = SYSTEM` e `kind = STANDARD`. Eles:

* não podem ser editados nem excluídos;
* podem ser desativados e reativados;
* servem para entradas e saídas.

---

## 4. Métodos personalizados

O usuário pode criar métodos comuns adicionais (por exemplo, Vale-refeição, Vale-transporte), com `source = USER` e `kind = STANDARD`.

* O fluxo genérico de criação cria **somente** métodos `STANDARD`.
* Métodos `CREDIT_CARD` são criados somente pelo fluxo de cartão (`credit-cards.md` §3), junto com o `CreditCard`.
* Não existe método genérico `CRÉDITO`, nem método com comportamento de crédito sem `CreditCard`.

---

## 5. Nome

* Obrigatório; 1 a 100 caracteres após trim; sem espaços no início ou no fim.
* Único entre **todos** os métodos (comuns e cartões, ativos e inativos), sem diferenciar maiúsculas/minúsculas.
* Editar o nome preserva o identificador e os vínculos.
* Nome de método `SYSTEM` não pode ser editado.
* Nome de cartão é editado pelo fluxo de cartão.

---

## 6. Natureza

O método não tem natureza financeira. O mesmo método pode ser usado em entradas e saídas; a natureza vem da categoria.

```text
Salário · INCOME · PIX
Conta de luz · EXPENSE · PIX
```

---

## 7. Ativação, desativação e reativação

* Todo método criado pelo usuário começa ativo.
* Qualquer método, inclusive do sistema e cartões, pode ser desativado e reativado.
* Método desativado:
  * continua armazenado, com identificador, nome, origem e tipo;
  * não aparece para novos lançamentos e é rejeitado se referenciado diretamente;
  * não pode ser usado para pagar fatura (`invoices.md` §9);
  * bloqueia a geração e a projeção de ocorrências das recorrências que o usam, sem alterar essas recorrências (`recurrences.md` §14);
  * para cartões, impede novas compras (`credit-cards.md` §13);
  * continua visível no histórico.
* A reativação não altera lançamentos existentes nem cria ocorrências retroativas.

---

## 8. Exclusão

Métodos nunca são excluídos. Não existe operação de exclusão.

---

## 9. Histórico e meses fechados

* Desativar um método não altera lançamentos existentes, inclusive de meses fechados.
* O método de lançamento de mês fechado não pode ser alterado.
* Na edição de um lançamento de mês aberto, não é obrigatório trocar um método que foi desativado depois.

---

## 10. Interface

```text
MÉTODOS DE PAGAMENTO                    [ + Novo método ]

ATIVOS
PIX                   Sistema
Dinheiro              Sistema
Débito                Sistema
Vale-refeição         Personalizado
Nubank                Cartão de crédito

INATIVOS
Vale-transporte       Personalizado
Cartão antigo         Cartão de crédito
```

| Método | Pode | Não pode |
|---|---|---|
| Sistema ativo | desativar | editar, excluir |
| Sistema inativo | reativar | editar, excluir |
| Personalizado ativo | editar, desativar | excluir |
| Personalizado inativo | editar, reativar | excluir |
| Cartão | editar (fluxo de cartão), desativar, reativar | excluir |

Estados da tela: carregando, lista preenchida, lista vazia (tratada mesmo que os métodos do sistema normalmente existam) e erro com nova tentativa.

---

## 11. Regras de negócio

* **RN-MET-01** — O sistema fornece PIX, Dinheiro e Débito (`SYSTEM`, `STANDARD`) a cada conta criada.
* **RN-MET-02** — O usuário cria métodos `STANDARD`; cartões são criados somente pelo fluxo de cartão.
* **RN-MET-03** — Métodos do sistema não são editáveis.
* **RN-MET-04** — Qualquer método pode ser desativado e reativado.
* **RN-MET-05** — Métodos nunca são excluídos.
* **RN-MET-06** — Método inativo não é usado em novos lançamentos, em pagamento de fatura nem em novas ocorrências de recorrência.
* **RN-MET-07** — Um método serve para entradas e saídas.
* **RN-MET-08** — Não existe método genérico `CRÉDITO`; todo `CREDIT_CARD` tem `CreditCard`.
* **RN-MET-09** — Nome único entre todos os métodos do mesmo usuário (PD-40); editar preserva o identificador.
* **RN-MET-10** — `name` e `active` do cartão existem somente no `PaymentMethod`.
* **RN-MET-11** — `source` e `kind` não são alterados pelo usuário.
* **RN-MET-12** — Método de lançamento de mês fechado é imutável; desativação não altera o histórico.

---

## 12. Critérios de aceitação

* **CA-MET-01** — Instalação inicial tem PIX, Dinheiro e Débito (`SYSTEM`).
* **CA-MET-02** — Criar método → ativo, `USER`, `STANDARD`.
* **CA-MET-03** — Editar nome de método personalizado preserva o identificador.
* **CA-MET-04** — Editar PIX → rejeitado.
* **CA-MET-05** — Desativar → armazenado e indisponível para novos lançamentos.
* **CA-MET-06** — Reativar → disponível novamente.
* **CA-MET-07** — Não existe exclusão.
* **CA-MET-08** — Lançamento continua com o método desativado.
* **CA-MET-09** — Método ativo usado em entrada e em saída → válido.
* **CA-MET-10** — Criar método com comportamento de crédito pelo fluxo genérico → impossível; cartão só pelo fluxo de cartão.
* **CA-MET-11** — Nome de método igual ao de um cartão existente → rejeitado.
* **CA-MET-12** — Alterar método de lançamento de mês fechado → rejeitado.
* **CA-MET-13** — Recorrência com método desativado não gera ocorrências.

---

## 13. Testes obrigatórios

* métodos do sistema: existência, origem, não editáveis, não excluíveis;
* métodos personalizados: criação, edição, identificador, duplicidade com métodos e cartões;
* ativação, desativação e reativação (inclusive do sistema e de cartões);
* uso em entradas e saídas;
* cartão como `CREDIT_CARD` com `CreditCard`; ausência de `CRÉDITO` genérico;
* efeitos da desativação em lançamentos, pagamento de fatura e recorrências;
* preservação histórica e mês fechado.

---

## 14. Fora de escopo

Regras de fatura, ciclo, parcelamento e recorrência (specs próprias), integração bancária, categorização automática e métodos compartilhados entre usuários.
