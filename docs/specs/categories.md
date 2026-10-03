# Feature Spec — Categorias

## 1. Objetivo

Permitir que o usuário crie e gerencie as categorias que classificam os lançamentos e determinam a sua natureza financeira.

Não existe lista fixa de categorias imposta pelo sistema, e nenhuma categoria é obrigatória ou hard-coded. Isso inclui não existir uma categoria de "Estorno": estornos não usam categoria (`refunds.md`).

---

## 2. Escopo

Contempla criação, listagem, edição, ativação, desativação, reativação, tipo financeiro, validação de nomes, preservação histórica e uso em lançamentos e recorrências.

Não contempla: criação de lançamentos, métodos de pagamento, cartões, relatórios, dashboards, categorização automática e exclusão física.

---

## 3. Estrutura

```text
Category
├── id
├── name
├── type        (INCOME | EXPENSE)
├── active      (booleano)
├── created_at
└── updated_at
```

---

## 4. Tipo (natureza financeira)

| Valor persistido | Label na UI | Efeito |
|---|---|---|
| `INCOME` | Entrada | lançamento é entrada |
| `EXPENSE` | Saída | lançamento é saída |

* Cada categoria tem exatamente um tipo. Não existem outros tipos (neutro, transferência, outros).
* O tipo da categoria é a **única** fonte da natureza financeira do lançamento. O lançamento não tem natureza própria que possa contradizer a categoria.

### 4.1 Imutabilidade do tipo (PD-21)

* O tipo pode ser alterado somente enquanto a categoria **não tiver nenhum uso**.
* **Uso** é qualquer registro persistido que dependa da categoria: lançamentos (de qualquer origem, inclusive parcelas e ocorrências geradas) e recorrências.
* Depois do primeiro uso, o tipo é imutável, mesmo que os registros dependentes estejam em meses abertos.

---

## 5. Nome

* Obrigatório; 1 a 100 caracteres após trim; sem espaços no início ou no fim.
* Único sem diferenciar maiúsculas/minúsculas, considerando categorias ativas e inativas.

```text
Existe "Alimentação" → não é possível criar "alimentação"
```

* Editar o nome preserva o identificador e todos os vínculos. A edição nunca cria uma nova categoria.

---

## 6. Ativação, desativação e reativação

* Toda categoria nova começa ativa.
* Categoria desativada:
  * continua armazenada, com o mesmo identificador e todos os vínculos;
  * não aparece para novos lançamentos e é rejeitada se referenciada diretamente na criação;
  * bloqueia a geração e a projeção de ocorrências das recorrências que a usam, sem alterar essas recorrências (`recurrences.md` §14);
  * continua visível no histórico.
* Categoria reativada volta a estar disponível com o mesmo identificador, nome, tipo e histórico. A reativação não cria ocorrências retroativas.

---

## 7. Exclusão

Categorias nunca são excluídas. Não existe operação de exclusão. Quando uma categoria deixa de ser usada, ela é desativada.

---

## 8. Histórico e meses fechados

* Desativar, reativar ou renomear uma categoria não altera lançamentos existentes.
* A categoria de um lançamento de mês fechado não pode ser alterada.
* A referência é sempre o identificador persistente, nunca o nome.

---

## 9. Interface

A tela mostra as categorias separadas por estado (ativas, inativas) e por tipo (entradas, saídas), deixando claros o nome, o tipo, o estado e as ações disponíveis.

```text
CATEGORIAS                         [ + Nova categoria ]

ATIVAS
  Entradas: Salário, Freelance
  Saídas:   Alimentação, Combustível, Moradia

INATIVAS
  Saídas:   Categoria antiga
```

| Estado | Pode | Não pode |
|---|---|---|
| Ativa | editar, desativar | excluir |
| Inativa | editar, reativar | excluir |

Estados da tela: carregando, lista preenchida, lista vazia e erro com nova tentativa.

---

## 10. Regras de negócio

* **RN-CAT-01** — Não há lista fixa nem categoria obrigatória ou hard-coded.
* **RN-CAT-02** — Tipos: `INCOME` e `EXPENSE`.
* **RN-CAT-03** — Toda categoria nova começa ativa.
* **RN-CAT-04** — Nome obrigatório, 1 a 100 caracteres, único sem diferenciar maiúsculas/minúsculas, entre ativas e inativas.
* **RN-CAT-05** — Editar o nome preserva o identificador.
* **RN-CAT-06** — Categorias podem ser desativadas e reativadas; nunca excluídas.
* **RN-CAT-07** — Categoria inativa não é usada em novos lançamentos e bloqueia ocorrências de recorrências.
* **RN-CAT-08** — A natureza do lançamento é o tipo da categoria.
* **RN-CAT-09** — O tipo só pode mudar enquanto não existir nenhum uso persistido da categoria.
* **RN-CAT-10** — Desativação, reativação e renomeação não alteram o histórico.
* **RN-CAT-11** — A categoria de lançamento de mês fechado é imutável.

---

## 11. Critérios de aceitação

* **CA-CAT-01** — Criar com nome e tipo válidos → categoria ativa.
* **CA-CAT-02** — Tipo diferente de `INCOME`/`EXPENSE` → rejeitado.
* **CA-CAT-03** — Nome vazio ou acima do limite → rejeitado.
* **CA-CAT-04** — Existindo "Alimentação", criar "alimentação" → rejeitado.
* **CA-CAT-05** — Renomear preserva o identificador.
* **CA-CAT-06** — Desativar → não aparece para novos lançamentos; criação que a referencia é rejeitada.
* **CA-CAT-07** — Reativar → volta a estar disponível.
* **CA-CAT-08** — Não existe operação de exclusão.
* **CA-CAT-09** — Lançamento continua associado à categoria desativada.
* **CA-CAT-10** — Alterar o tipo de categoria sem uso → aceito.
* **CA-CAT-11** — Alterar o tipo de categoria usada por lançamento ou recorrência → rejeitado.
* **CA-CAT-12** — Alterar categoria de lançamento de mês fechado → rejeitado.
* **CA-CAT-13** — Recorrência com categoria desativada não gera nem projeta ocorrências.

---

## 12. Testes obrigatórios

* criação, tipos, ativa por padrão;
* nome: vazio, limite, duplicidade sem diferenciar maiúsculas/minúsculas, entre ativas e inativas;
* renomeação com o mesmo identificador;
* desativação, reativação e uso em novos lançamentos;
* imutabilidade do tipo com uso (lançamento, recorrência) e alteração sem uso;
* efeito em recorrências;
* preservação histórica e mês fechado.
